// agent-chat/server.js
//
// Two listeners, both bound exclusively to 127.0.0.1:
//
//   TCP port 4000  — agent-chat protocol (WebSocket)
//                    bridge agents authenticate with their agentId, then send
//                    JSON ChatMessage objects.
//
//   HTTP port 4001 — dashboard (HTTP GET /) + WebSocket fan-out to browsers.
//                    All incoming agent messages are broadcast here in real time.
//
// Security:
//   - Both servers bind '127.0.0.1', never '0.0.0.0'.
//   - HTML escaping is applied server-side before any JSON payload is sent to
//     dashboard clients (belt-and-suspenders; dashboard JS also uses textContent).
//   - No external dependencies beyond the built-in 'ws' module.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AGENT_HOST = '127.0.0.1';
const AGENT_PORT = 4000;   // bridge → server (agent WebSocket protocol)
const DASH_HOST  = '127.0.0.1';
const DASH_PORT  = 4001;   // browser → server (dashboard HTTP + WS)

const VALID_AGENTS = new Set(['emily', 'fc', 'jared', 'stevey', 'pm-cory', 'nando']);
const VALID_LEVELS = new Set(['phase', 'decision', 'conversation']);

// Message history kept in memory — last 500 messages.
const MAX_HISTORY = 500;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {Array<{agent: string, level: string, message: string, timestamp: number, room: string}>} */
const messageHistory = [];

/** @type {Map<WebSocket, {agentId: string|null}>} */
const agentClients = new Map();

/** @type {Set<WebSocket>} */
const dashboardClients = new Set();

let currentRoom = '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** HTML-escape a string for safe embedding in JSON sent to browsers. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function log(msg) {
  process.stderr.write(`[agent-chat] ${msg}\n`);
}

/** Broadcast a message payload to all connected dashboard WebSocket clients. */
function broadcastToDashboard(payload) {
  const data = JSON.stringify(payload);
  for (const ws of dashboardClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/** Store a message in history (capped at MAX_HISTORY) and broadcast it. */
function recordAndBroadcast(msg) {
  // HTML-escape content before storing so every broadcast path is safe
  const safe = {
    agent:     escapeHtml(msg.agent),
    level:     escapeHtml(msg.level),
    message:   escapeHtml(msg.message),
    timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
    room:      escapeHtml(msg.room ?? currentRoom),
  };

  messageHistory.push(safe);
  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift();
  }

  broadcastToDashboard({ type: 'message', ...safe });
}

/** Broadcast a lifecycle event to dashboard clients. */
function broadcastLifecycle(event, extra) {
  // Escape all string values in extra to prevent injection via spread
  const safeExtra = {};
  if (extra && typeof extra === 'object') {
    for (const [k, v] of Object.entries(extra)) {
      safeExtra[k] = typeof v === 'string' ? escapeHtml(v) : v;
    }
  }
  broadcastToDashboard({
    type:      'lifecycle',
    event:     escapeHtml(event),
    timestamp: Date.now(),
    ...safeExtra,
  });
}

// ---------------------------------------------------------------------------
// Port 4000 — Agent WebSocket server (bridge → here)
// ---------------------------------------------------------------------------

const agentServer = http.createServer((_req, res) => {
  res.writeHead(404).end('Not Found');
});

const wssAgents = new WebSocketServer({ server: agentServer });

wssAgents.on('connection', (ws) => {
  agentClients.set(ws, { agentId: null });
  log('Agent client connected (unauthenticated)');

  ws.on('message', (raw) => {
    const text = raw.toString('utf8').trim();
    const state = agentClients.get(ws);
    if (!state) return;

    // -----------------------------------------------------------------------
    // Authentication: first message is the agentId
    // -----------------------------------------------------------------------
    if (state.agentId === null) {
      if (VALID_AGENTS.has(text)) {
        state.agentId = text;
        log(`Agent authenticated: ${text}`);
        // Send history replay so reconnecting agents get context
        ws.send(JSON.stringify({ type: 'history', messages: messageHistory }));
      } else {
        log(`Auth rejected: unknown agentId "${text}"`);
        ws.close(1008, 'Unknown agent');
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Commands
    // -----------------------------------------------------------------------
    if (text.startsWith('/join ')) {
      const room = text.slice(6).trim();
      currentRoom = room;
      log(`Room changed to: ${room}`);
      broadcastLifecycle('room-changed', { room: escapeHtml(room) });
      return;
    }

    // -----------------------------------------------------------------------
    // JSON ChatMessage
    // -----------------------------------------------------------------------
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      log(`Malformed JSON from ${state.agentId}: ${text.slice(0, 80)}`);
      return;
    }

    // Validate shape
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !VALID_AGENTS.has(parsed.agent) ||
      !VALID_LEVELS.has(parsed.level) ||
      typeof parsed.message !== 'string' ||
      parsed.message.length === 0 ||
      parsed.message.length > 2000
    ) {
      log(`Invalid ChatMessage shape from ${state.agentId}`);
      return;
    }

    recordAndBroadcast(parsed);
  });

  ws.on('close', () => {
    const state = agentClients.get(ws);
    if (state?.agentId) {
      log(`Agent disconnected: ${state.agentId}`);
    }
    agentClients.delete(ws);
  });

  ws.on('error', (err) => {
    log(`Agent WS error: ${err.message}`);
  });
});

agentServer.listen(AGENT_PORT, AGENT_HOST, () => {
  log(`Agent WS server listening on ws://${AGENT_HOST}:${AGENT_PORT}`);
});

// ---------------------------------------------------------------------------
// Port 4001 — Dashboard HTTP server + WebSocket fan-out (browser → here)
// ---------------------------------------------------------------------------

const dashServer = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500).end('Internal Server Error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      }).end(data);
    });
    return;
  }

  res.writeHead(404).end('Not Found');
});

const wssDash = new WebSocketServer({ server: dashServer });

wssDash.on('connection', (ws) => {
  dashboardClients.add(ws);
  log('Dashboard client connected');

  // Send current state immediately on connect
  ws.send(JSON.stringify({
    type: 'init',
    room: escapeHtml(currentRoom),
    history: messageHistory,
  }));

  ws.on('close', () => {
    dashboardClients.delete(ws);
    log('Dashboard client disconnected');
  });

  ws.on('error', (err) => {
    log(`Dashboard WS error: ${err.message}`);
    dashboardClients.delete(ws);
  });
});

dashServer.listen(DASH_PORT, DASH_HOST, () => {
  log(`Dashboard HTTP server listening on http://${DASH_HOST}:${DASH_PORT}`);
  log(`Dashboard WS  server listening on ws://${DASH_HOST}:${DASH_PORT}`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  log(`Received ${signal}, shutting down`);

  for (const ws of agentClients.keys()) ws.close();
  for (const ws of dashboardClients) ws.close();

  agentServer.close(() => {
    dashServer.close(() => {
      log('Clean exit');
      process.exit(0);
    });
  });

  // Force-exit after 5 s if something hangs
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
