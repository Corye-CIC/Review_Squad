#!/usr/bin/env node
// debate.js — General-purpose debate orchestrator for agent-chat
//
// Usage:
//   node debate.js "<topic>"
//
// Flow:
//   1. Assigns a distinct position to each agent based on the topic
//   2. Round 1  — opening statements
//   3. Nando    — interim verdict based on round 1
//   4. Round 2  — rebuttals (agents respond to interim verdict + each other)
//   5. Nando    — final verdict based on all evidence
//
// Requires: agent-chat server running on ws://127.0.0.1:4000

'use strict';

const { WebSocket }   = require('ws');
const { spawnSync }   = require('child_process');
const fs              = require('fs');
const os              = require('os');
const path            = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEBATE_CONFIG_PATH = path.join(os.tmpdir(), 'agent-chat-debate.json');
const WS_URL             = 'ws://127.0.0.1:4000';
const JUDGE              = 'nando';
const CONNECT_TIMEOUT_MS = 10_000;

const AGENT_PERSONAS = {
  emily:    'passionate product manager focused on user experience, historical impact, and broad appeal',
  fc:       'grizzled backend architect who values technical depth, emotional resonance, and systemic design',
  jared:    'pragmatic security engineer who prizes correctness, clean implementation, and freedom from technical debt',
  stevey:   'opinionated UX/UI designer who champions bold design choices, visual spectacle, and creative innovation',
  'pm-cory':'scope-conscious program manager who values tight focus, polish, and reliable delivery over raw ambition',
};

const JUDGE_PERSONA = 'lead architect and final arbiter — synthesises all arguments, calls out weaknesses by name, and delivers an unambiguous winner with no hedging';

// ---------------------------------------------------------------------------
// LLM via CLI — no shell involved (spawnSync + argument array)
// ---------------------------------------------------------------------------

function queryLLM(prompt) {
  const result = spawnSync('claude', ['-p', prompt, '--output-format', 'text'], {
    encoding: 'utf8',
    timeout:  60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`claude exited ${result.status}: ${result.stderr}`);
  return result.stdout.trim();
}

// ---------------------------------------------------------------------------
// WebSocket helpers
// ---------------------------------------------------------------------------

function connectAgent(agentId, room) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`connectAgent timeout waiting for ack (agentId=${agentId})`));
    }, CONNECT_TIMEOUT_MS);

    ws.on('open', () => ws.send(agentId));

    ws.once('message', (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { /* ignore non-JSON */ }
      if (data?.type === 'ack') {
        clearTimeout(timer);
        ws.send(`/join ${room}`);
        setTimeout(() => resolve(ws), 50);
      }
    });

    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function post(ws, agentId, level, message) {
  return new Promise((resolve) => {
    ws.send(JSON.stringify({ agent: agentId, level, message }));
    setTimeout(resolve, 100);
  });
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function assignPositions(topic) {
  const agentList = Object.entries(AGENT_PERSONAS)
    .map(([id, persona]) => `- ${id}: ${persona}`)
    .join('\n');

  const prompt = `Assign debate positions for the topic: "${topic}"

Each agent must defend a distinct, specific, genuinely defensible position. Positions should create real conflict — avoid overlap.

Agents:
${agentList}

Return ONLY valid JSON, no other text:
{
  "room": "<url-safe slug, max 30 chars, lowercase, hyphens only>",
  "topic": "${topic}",
  "assignments": {
    "emily":    "<specific position>",
    "fc":       "<specific position>",
    "jared":    "<specific position>",
    "stevey":   "<specific position>",
    "pm-cory":  "<specific position>"
  }
}`;

  const raw = queryLLM(prompt);
  const stripped = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  let config;
  try {
    config = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`assignPositions: failed to parse LLM response.\nRaw output:\n${raw}\nParse error: ${err.message}`);
  }
  return config;
}

function generateTurn(agentId, persona, position, topic, transcript) {
  const history = transcript.length === 0
    ? '(No messages yet.)'
    : transcript.map(m => `[${m.agent}]: ${m.message}`).join('\n\n');

  const isOpening = transcript.length === 0;

  const prompt = isOpening
    ? `You are ${agentId} — ${persona}. Debate topic: "${topic}". Your position: "${position}".

Give your opening statement defending your position. Be specific, passionate, and in character. 2–3 sentences. No hedging. No preamble like "As ${agentId}..." — just speak.`
    : `You are ${agentId} — ${persona}. Debate topic: "${topic}". Your position: "${position}".

Debate so far:
${history}

This is the rebuttal round. Respond directly to Nando's interim verdict. Challenge his reasoning if your position was undervalued. Add one new angle supporting your stance. 2–3 sentences. No hedging.`;

  return queryLLM(prompt);
}

function generateVerdict(topic, transcript, isFinal) {
  const history = transcript.map(m => `[${m.agent}]: ${m.message}`).join('\n\n');

  const prompt = isFinal
    ? `You are Nando — ${JUDGE_PERSONA}. Debate topic: "${topic}".

Full transcript including opening statements, your interim verdict, and rebuttals:
${history}

Deliver your FINAL verdict. Consider whether any rebuttal changed the balance. Acknowledge the strongest rebuttal from any agent in one sentence. Then declare the winner with a specific, unambiguous rationale. No ties. No hedging. 150–200 words.`
    : `You are Nando — ${JUDGE_PERSONA}. Debate topic: "${topic}".

Opening statements:
${history}

Deliver an INTERIM verdict based on the opening round. Identify the current leader and explain why in 2–3 sentences. Be clear about which arguments you found weakest — agents will rebut in the next round. No final decision yet.`;

  return queryLLM(prompt);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const topic = process.argv[2];
  if (!topic) {
    console.error('Usage: node debate.js "<topic>"');
    process.exit(1);
  }

  // Step 1 — Assign positions
  console.log('Assigning positions...');
  const config = assignPositions(topic);
  fs.writeFileSync(DEBATE_CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });

  console.log(`\nRoom:  ${config.room}`);
  console.log('Positions:');
  for (const [agent, pos] of Object.entries(config.assignments)) {
    console.log(`  ${agent.padEnd(10)} ${pos}`);
  }

  const agents = Object.keys(config.assignments);
  const transcript = [];

  // Step 2 — Connect all agents in parallel
  console.log('\nConnecting...');
  const connEntries = await Promise.all(
    [...agents, JUDGE].map(async (id) => {
      const ws = await connectAgent(id, config.room);
      process.stdout.write(`  ${id} connected\n`);
      return [id, ws];
    })
  );
  const conns = Object.fromEntries(connEntries);

  // Clear history from any previous debate, then announce
  conns[JUDGE].send('/clear');
  await new Promise(r => setTimeout(r, 100));

  console.log('\nDashboard: http://127.0.0.1:4001');

  // Announce
  await post(conns[JUDGE], JUDGE, 'phase',
    `Debate: "${topic}" — opening statements, interim verdict, rebuttals, final verdict. Begin.`);

  // Step 3 — Round 1: Opening statements
  console.log('\nRound 1 — Openings...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Round 1: Opening Statements ──');

  for (const agentId of agents) {
    process.stdout.write(`  ${agentId}...`);
    const message = generateTurn(agentId, AGENT_PERSONAS[agentId], config.assignments[agentId], topic, []);
    await post(conns[agentId], agentId, 'phase', message);
    transcript.push({ agent: agentId, message });
    process.stdout.write(' done\n');
  }

  // Step 4 — Interim verdict
  console.log('\nNando — interim verdict...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Nando: Interim Verdict ──');
  const interimVerdict = generateVerdict(topic, transcript, false);
  await post(conns[JUDGE], JUDGE, 'decision', interimVerdict);
  transcript.push({ agent: JUDGE, message: interimVerdict });

  // Step 5 — Round 2: Rebuttals
  console.log('\nRound 2 — Rebuttals...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Round 2: Rebuttals ──');

  for (const agentId of agents) {
    process.stdout.write(`  ${agentId}...`);
    const message = generateTurn(agentId, AGENT_PERSONAS[agentId], config.assignments[agentId], topic, transcript);
    await post(conns[agentId], agentId, 'conversation', message);
    transcript.push({ agent: agentId, message });
    process.stdout.write(' done\n');
  }

  // Step 6 — Final verdict
  console.log('\nNando — final verdict...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Nando: Final Verdict ──');
  const finalVerdict = generateVerdict(topic, transcript, true);
  await post(conns[JUDGE], JUDGE, 'decision', finalVerdict);
  console.log('Final verdict delivered.');

  // Cleanup
  for (const ws of Object.values(conns)) ws.close();
  console.log(`\nDone. Config at ${DEBATE_CONFIG_PATH} — cleared on /agent-chat:off`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
