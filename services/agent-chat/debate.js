#!/usr/bin/env node
// debate.js — General-purpose debate orchestrator for agent-chat
//
// Usage:
//   node debate.js "<topic>"
//
// Flow:
//   1. Uses `claude -p` to assign a distinct position to each agent based on the topic
//   2. Writes assignments to /tmp/agent-chat-debate.json (cleaned up by /agent-chat:off)
//   3. Runs 3 rounds of back-and-forth in the agent-chat room
//   4. Nando delivers the final verdict
//
// Requires: agent-chat server running on ws://127.0.0.1:4000

'use strict';

const { WebSocket }            = require('ws');
const { execSync }             = require('child_process');
const fs                       = require('fs');
const os                       = require('os');
const path                     = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEBATE_CONFIG_PATH = path.join(os.tmpdir(), 'agent-chat-debate.json');
const WS_URL             = 'ws://127.0.0.1:4000';
const ROUNDS             = 3;
const JUDGE              = 'nando';

const AGENT_PERSONAS = {
  emily:    'passionate product manager focused on user experience, historical impact, and broad appeal',
  fc:       'grizzled backend architect who values technical depth, emotional resonance, and systemic design',
  jared:    'pragmatic security engineer who prizes correctness, clean implementation, and freedom from technical debt',
  stevey:   'opinionated UX/UI designer who champions bold design choices, visual spectacle, and creative innovation',
  'pm-cory':'scope-conscious program manager who values tight focus, polish, and reliable delivery over raw ambition',
};

const JUDGE_PERSONA = 'lead architect and final arbiter — synthesises all arguments, calls out weaknesses by name, and delivers an unambiguous winner with no hedging';

// ---------------------------------------------------------------------------
// Claude via CLI
// ---------------------------------------------------------------------------

function ask(prompt) {
  const escaped = prompt.replace(/'/g, `'\\''`);
  const result = execSync(`claude -p '${escaped}' --output-format text`, {
    encoding: 'utf8',
    timeout: 60000,
  });
  return result.trim();
}

// ---------------------------------------------------------------------------
// WebSocket helpers
// ---------------------------------------------------------------------------

function connectAgent(agentId, room) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => ws.send(agentId));
    ws.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'ack') {
        ws.send(`/join ${room}`);
        setTimeout(() => resolve(ws), 150);
      }
    });
    ws.on('error', reject);
  });
}

function post(ws, agentId, level, message) {
  return new Promise((resolve) => {
    ws.send(JSON.stringify({ agent: agentId, level, message }));
    setTimeout(resolve, 900);
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

  const raw = ask(prompt);
  // Strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(json);
}

function generateTurn(agentId, persona, position, topic, transcript, round) {
  const isOpening = round === 1;
  const history = transcript.length === 0
    ? '(No messages yet.)'
    : transcript.map(m => `[${m.agent}]: ${m.message}`).join('\n\n');

  const prompt = isOpening
    ? `You are ${agentId} — ${persona}. Debate topic: "${topic}". Your position: "${position}".

Give your opening statement defending your position. Be specific, passionate, and in character. 2–3 sentences. No hedging. No preamble like "As Emily..." — just speak.`
    : `You are ${agentId} — ${persona}. Debate topic: "${topic}". Your position: "${position}".

Debate so far:
${history}

Round ${round}. Respond to what was just said. Call out the weakest opposing argument by the agent's name. Add one new angle supporting your own position. 2–3 sentences. No hedging. Speak directly, don't announce who you are.`;

  return ask(prompt);
}

function generateVerdict(topic, transcript) {
  const history = transcript.map(m => `[${m.agent}]: ${m.message}`).join('\n\n');

  const prompt = `You are Nando — ${JUDGE_PERSONA}. Debate topic: "${topic}".

Full transcript:
${history}

Deliver the verdict. One sentence acknowledging the strongest point from each debater. Then declare the winner with a specific, unambiguous rationale. No ties. No hedging. 150–200 words.`;

  return ask(prompt);
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
  fs.writeFileSync(DEBATE_CONFIG_PATH, JSON.stringify(config, null, 2));

  console.log(`\nRoom:  ${config.room}`);
  console.log('Positions:');
  for (const [agent, pos] of Object.entries(config.assignments)) {
    console.log(`  ${agent.padEnd(10)} ${pos}`);
  }

  const agents = Object.keys(config.assignments);
  const transcript = [];

  // Step 2 — Connect all agents + judge
  console.log('\nConnecting...');
  const conns = {};
  for (const id of [...agents, JUDGE]) {
    conns[id] = await connectAgent(id, config.room);
    process.stdout.write(`  ${id} connected\n`);
  }

  // Announce
  await post(conns[JUDGE], JUDGE, 'phase',
    `Debate: "${topic}" — 3 rounds, winner takes all. Positions assigned. Begin.`);

  // Step 3 — Rounds
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\nRound ${round}...`);
    await post(conns[JUDGE], JUDGE, 'phase', `── Round ${round} ──`);

    for (const agentId of agents) {
      process.stdout.write(`  ${agentId}...`);
      const message = generateTurn(
        agentId,
        AGENT_PERSONAS[agentId],
        config.assignments[agentId],
        topic,
        transcript,
        round,
      );
      const level = round === 1 ? 'phase' : 'conversation';
      await post(conns[agentId], agentId, level, message);
      transcript.push({ agent: agentId, message });
      process.stdout.write(` done\n`);
    }
  }

  // Step 4 — Verdict
  console.log('\nNando deliberating...');
  await post(conns[JUDGE], JUDGE, 'phase', '── Verdict ──');
  const verdict = generateVerdict(topic, transcript);
  await post(conns[JUDGE], JUDGE, 'decision', verdict);
  console.log('Verdict delivered.');

  // Close connections
  for (const ws of Object.values(conns)) ws.close();

  console.log(`\nDone. Config at ${DEBATE_CONFIG_PATH} — cleared on /agent-chat:off`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
