# Agent-Chat Integration Design

## Overview

Integrate [agent-chat](https://github.com/zchristmas-cic/agent-chat) into SubAgents to enable real-time cross-agent communication visible through a web dashboard. Agents post messages as they work; users observe the squad collaborating in real-time.

## Requirements

- Agents post findings, decisions, and phase transitions to chat rooms during command execution
- Users see cross-agent communication in a browser dashboard (observe-only in v1)
- Configurable verbosity: phase-level, decision-level, or conversation-level (default: decision)
- Chat is observability — never blocks agent work. Graceful degradation if chat is unavailable.
- Foundation for future user-to-agent messaging (architected but not implemented in v1)

## Decisions

- **agent-chat ownership:** Copied into `services/agent-chat/` (full ownership, no submodule dependency)
- **Server lifecycle:** Always-on background process (user-managed)
- **Integration approach:** Hybrid — agent-aware client (chat-send.sh) + bridge for lifecycle automation
- **Agent definitions unchanged:** Agents learn about chat through command prompts, not their definition files

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  agent-chat server               │
│              (services/agent-chat/)               │
│  TCP:4000  │  HTTP+WS:4001  │  Dashboard UI     │
└──────┬──────────────┬──────────────┬─────────────┘
       │              │              │
       │         WebSocket      Browser
       │              │          (user)
       │              │
┌──────┴──────────────┴─────────────────────────┐
│              chat-bridge                       │
│         (services/chat-bridge/)                │
│                                                │
│  • Manages WS connections per agent identity   │
│  • Exposes CLI helper: chat-send.sh            │
│  • Handles room lifecycle (auto-join/leave)    │
│  • Verbosity filtering (phase/decision/convo)  │
│  • Profile registration on first connect       │
└──────┬────────────────────────────────────────┘
       │
┌──────┴────────────────────────────────────────┐
│           SubAgents commands + agents          │
│                                                │
│  Commands inject chat instructions into        │
│  agent prompts. Agents call chat-send.sh       │
│  to post messages. Hook handles lifecycle.     │
└────────────────────────────────────────────────┘
```

## Components

### 1. agent-chat Server (`services/agent-chat/`)

Copied from the GitHub repository. Runs as an always-on background process.

- **TCP server** on port 4000 for direct agent connections
- **HTTP + WebSocket server** on port 4001 for dashboard and agent API
- **Dashboard UI** at `http://localhost:4001` — real-time observer view of all rooms and messages
- **Profile system** — file-based storage in `data/profiles/` with name, bio, role, avatar
- **Room-based messaging** — agents join rooms, messages broadcast within rooms, transcripts persisted

**Protocol summary:**
- WebSocket auth: send agent name to authenticate, or `__observe__` for dashboard mode
- Messages: newline-delimited text, prefixed with `[agentId]`
- Observer events: JSON `{type: "message", room, text}` and `{type: "room_update", room, agents, isNew}`
- REST: `GET /api/state`, `GET/PUT /api/profile/:name`, `POST /api/avatar/:name`

### 2. Chat Bridge (`services/chat-bridge/`)

New Node.js module that mediates between SubAgents and agent-chat.

**`bridge.ts`** — Core process:

```typescript
// State
connections: Map<string, WebSocket>  // persistent per-agent WS connections
verbosity: "phase" | "decision" | "conversation"
currentRoom: string

// Lifecycle
// 1. Start: connect 6 agents (emily, fc, jared, stevey, pm-cory, nando)
// 2. Each authenticates by name, joins current room
// 3. Listens on localhost:4002 for commands from chat-send.sh and hook
```

**HTTP API (localhost:4002):**

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/send` | POST | `{agent, message, level}` | Post message if level >= verbosity |
| `/room` | POST | `{name}` | Move all agents to new room |
| `/lifecycle` | POST | `{event, agent, data}` | System messages (join/leave/phase) |
| `/status` | GET | — | Connection health check |
| `/verbosity` | POST | `{level}` | Change filtering level |

**`chat-send.sh`** — Bash helper that agents invoke:

Located at `services/chat-bridge/chat-send.sh`. Agents reference it by absolute path, injected into prompts via the command's chat context block (see Section 3).

```bash
#!/bin/bash
# Usage: /path/to/chat-send.sh <agent> <level> <message>
# Levels: phase, decision, conversation
curl -s --max-time 1 -X POST http://localhost:4002/send \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"$1\",\"level\":\"$2\",\"message\":\"$3\"}" || true
```

Fire-and-forget with 1-second timeout. `|| true` ensures failures never break agent execution.

**`verbosity.ts`** — Filtering logic:

```
Hierarchy: phase < decision < conversation

Setting "decision" passes: phase + decision messages
Setting "phase" passes: phase messages only
Setting "conversation" passes: everything
```

Messages below the threshold are silently dropped at the bridge — they never reach agent-chat.

**`profiles.ts`** — Agent identity registration:

| Agent | Display Name | Role | Bio |
|-------|-------------|------|-----|
| emily | Emily | Product Manager | Requirements, validation tests, accessibility, final quality gate |
| fc | Father Christmas | Backend Architect | Database design, code quality, business logic, SOLID principles |
| jared | Jared | Security Engineer | Auth, validation, API hardening, efficiency, code reuse |
| stevey | Stevey Boy Choi | UX/UI Designer | Frontend, accessibility, microservices connectivity |
| pm-cory | PM Cory | Program Manager | Coordination, persistent memory, creative challenge |
| nando | Nando | Lead Architect | Squad director, conflict resolution, synthesis, verdicts |

Profiles registered via `PUT /api/profile/:name` on bridge startup. No avatars in v1.

### 3. Command Modifications

Each command file gets a chat context block inserted into every agent's prompt. The block is placed inside the agent's task description (the string passed to the Agent tool's `prompt` parameter), after the main task instructions and before any file context.

**Chat context block template:**

```
## Cross-Agent Chat
You are connected to the team chat. Post updates as you work:
- Phase transitions: $CHAT_SEND "<your-name>" "phase" "<message>"
- Key findings/decisions: $CHAT_SEND "<your-name>" "decision" "<message>"
- Detailed reasoning: $CHAT_SEND "<your-name>" "conversation" "<message>"

Use Bash tool to call the script above. Keep messages concise (1-2 sentences).
Current room: $ROOM_NAME
```

Where `$CHAT_SEND` is the absolute path to `chat-send.sh`. The path is resolved from the SubAgents project root, not `$(pwd)` (which may differ if agents `cd` into a target project). Commands determine the SubAgents root via `git -C "$(dirname "$0")" rev-parse --show-toplevel` or by reading it from the bridge's PID file companion `$BRIDGE_PID_FILE.root`. `$ROOM_NAME` is the current room.

**Room name generation:**

Each command is responsible for generating the room name. The room name is derived from `$ARGUMENTS` using this algorithm:
1. Take `$ARGUMENTS`, lowercase, replace non-alphanumeric characters with hyphens, collapse consecutive hyphens
2. Take the first 5 hyphen-delimited tokens
3. Prefix with the command name: `{command}-{slug}`
4. Example: `/consult Add OAuth login flow` → `consult-add-oauth-login-flow`

The command also calls the bridge to create/join the room before spawning agents:

```bash
curl -s --max-time 2 -X POST http://localhost:4002/room \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$ROOM_NAME\"}" || true
```

**Room naming per command:**

| Command | Room Name | Agents in Room |
|---------|-----------|----------------|
| `/discuss` | `discuss-{slug}` | Emily, PM Cory |
| `/research` | `research-{slug}` | Emily, PM Cory |
| `/plan` | `plan-{slug}` | Emily, PM Cory |
| `/consult` | `consult-{slug}` | FC, Jared, Stevey, PM Cory → then Nando |
| `/implement` | `implement-{slug}` | Wave agents + Emily + PM Cory + Nando |
| `/review` | `review-{slug}` | FC, Jared, Stevey, PM Cory → Nando → Emily |
| `/ship` | `ship-{slug}` | Emily, PM Cory |

### 4. Hook Extension (`review-squad-gate.js`) + Command-Level Lifecycle

Lifecycle events come from two sources:

**Source 1: Command prompts (phase start/room setup)**

The hook is a PostToolUse hook — it fires *after* tool invocations, not before commands. Therefore, **command start events are posted by the command itself**, not the hook. Each command file includes a Bash call at the top of its orchestration (before spawning agents) that:
1. Creates/joins the room via `POST /room`
2. Posts the phase start event via `POST /lifecycle`

```bash
# At top of each command, before agent spawning:
ROOM_NAME="consult-$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -d- -f1-5)"
curl -s --max-time 2 -X POST http://localhost:4002/room -H "Content-Type: application/json" -d "{\"name\":\"$ROOM_NAME\"}" || true
curl -s --max-time 1 -X POST http://localhost:4002/lifecycle -H "Content-Type: application/json" -d "{\"event\":\"phase_start\",\"data\":\"$COMMAND_NAME — $ARGUMENTS\"}" || true
```

**Source 2: Hook (mid-phase and completion events)**

The hook detects events via regex on Agent tool output (same approach already used for review completion detection) and posts to the bridge:

**Hook-detected events:**
- `[system] Nando verdict: {APPROVE|REVISE|BLOCK}` — regex: `/(?:Review Squad|Final Verdict):\s*(APPROVE|REVISE|BLOCK)/i`
- `[system] Emily: {CONFIRM|CHALLENGE}` — regex: `/Emily.*(?:CONFIRM|CHALLENGE)/i`
- `[system] PR created — {url}` — regex on `gh pr create` output
- `[system] CI: {PASS|FAIL}` — existing PR sentinel file detection

**Events NOT detected by hook (posted by command prompts instead):**
- Phase start — command posts before spawning agents
- Wave completion — command posts between wave dispatches
- Phase end — command posts after all agents return

All lifecycle posts use the same fire-and-forget curl pattern. Hook never blocks existing review gate logic — chat posting is appended after all existing logic runs.

### 5. Agent Connection Lifecycle

1. Bridge starts → registers 6 profiles via REST API
2. Opens 6 WebSocket connections, each authenticating as the agent name
3. All connections join a `lobby` room by default
4. When a command starts, hook posts to bridge `POST /room` → agents move to command room
5. When command finishes, agents return to lobby
6. Dashboard shows all 6 agents as persistent presences — they move between rooms, never flicker

## Data Flow Example

Walking through `/consult Add OAuth login`:

```
1. User types: /consult Add OAuth login

2. Command runs startup bash block:
   → Checks/starts bridge via PID file
   → bridge POST /room {name: "consult-add-oauth-login"}
   → bridge POST /lifecycle {event: "phase_start", data: "consult — Add OAuth login"}
   → Dashboard: [system] /consult started — Add OAuth login

3. Command spawns FC, Jared, Stevey, PM Cory in parallel
   Each agent's prompt includes chat-send.sh path + room name

4. FC posts via chat-send.sh:
   → "Recommending PostgreSQL with row-level security for OAuth tokens"
   → "Quality gate: all token storage must use encrypted columns"

5. Jared posts simultaneously:
   → "Security WARN: need PKCE flow, not implicit grant"
   → "Requiring CSRF protection on all OAuth callback routes"

6. Stevey posts:
   → "Login button needs WCAG AA focus indicators"

7. PM Cory posts:
   → "Prior learning: last auth work used bcrypt — maintaining consistency"

8. All 4 complete → Command posts lifecycle event:
   → [system] All consultation briefs received — Nando synthesizing
   → Command spawns Nando

9. Nando posts via chat-send.sh:
   → "Resolving FC/Jared token storage: encrypted columns + RLS — both satisfied"
   → "Implementation Brief complete — 2 waves, FC+Jared wave 1, Stevey wave 2"

10. Brief saved → Command posts lifecycle event:
    → [system] /consult complete — brief saved
```

## Error Handling & Resilience

**Principle: Chat is observability, not infrastructure.** If chat is down, agents work normally.

- **chat-send.sh:** Fire-and-forget, 1s timeout, `|| true` — never causes non-zero exit
- **Bridge reconnect:** If agent-chat is unreachable, bridge queues messages in memory (max 100 per agent, FIFO eviction), reconnects every 5 seconds
- **Bridge down:** chat-send.sh fails silently (curl timeout + `|| true`)
- **Hook:** Lifecycle posts use same fire-and-forget pattern, never block existing review gate logic

**Startup order:**
1. agent-chat server (always-on, user starts it: `cd services/agent-chat && pnpm start`)
2. chat-bridge (auto-started by first command invocation, details below)
3. SubAgents commands work regardless of 1 and 2 being up

**Bridge auto-start mechanism:**

Each command file includes a bridge startup check at the top (before room creation and agent spawning):

```bash
# Check if bridge is already running via PID file
BRIDGE_PID_FILE="/tmp/chat-bridge.pid"
if [ -f "$BRIDGE_PID_FILE" ] && kill -0 "$(cat "$BRIDGE_PID_FILE")" 2>/dev/null; then
  : # bridge already running
else
  # Start bridge in background, record PID
  node "$(pwd)/services/chat-bridge/bridge.js" &
  echo $! > "$BRIDGE_PID_FILE"
  echo "$SUBAGENTS_ROOT" > "$BRIDGE_PID_FILE.root"  # companion file for path resolution
  sleep 1  # allow bridge to connect to agent-chat
fi
CHAT_SEND="$(cat "$BRIDGE_PID_FILE.root")/services/chat-bridge/chat-send.sh"
```

The bridge process:
- Writes its PID to `/tmp/chat-bridge.pid` on startup
- Exits cleanly on SIGTERM/SIGINT (removes PID file)
- If it crashes, the PID file goes stale — next command detects this via `kill -0` and restarts
- The bridge is a long-lived process — once started, it stays running for the session
- If agent-chat is not running, the bridge starts anyway and queues messages until it connects
- To stop the bridge manually: `kill $(cat /tmp/chat-bridge.pid)` — the bridge handles SIGTERM cleanly and removes its PID file

**Port configuration:**

All ports are configurable via environment variables with sensible defaults:

| Variable | Default | Component |
|----------|---------|-----------|
| `AGENT_CHAT_TCP_PORT` | 4000 | agent-chat TCP server |
| `AGENT_CHAT_HTTP_PORT` | 4001 | agent-chat HTTP + WebSocket |
| `CHAT_BRIDGE_PORT` | 4002 | chat-bridge HTTP API |

The bridge reads `AGENT_CHAT_HTTP_PORT` to know where to connect WebSocket clients. `chat-send.sh` reads `CHAT_BRIDGE_PORT` for its curl target.

**Known v1 limitations:**
- Bridge message queue is in-memory only — lost on bridge restart
- Dashboard has no authentication — localhost access only, not suitable for network exposure
- Agent connections are eager (all 6 on startup) — could be lazy-connected on first message in a future version

**No new failure modes introduced to existing agent execution.**

## Testing Strategy

### Unit Tests (`services/chat-bridge/__tests__/`)

- Verbosity filtering: messages at each level correctly passed/dropped
- Room lifecycle: create, join, leave, agents move correctly
- Reconnect logic: simulated disconnect triggers reconnect + queue drain
- Profile registration: correct REST calls on startup

### Integration Tests (`services/chat-bridge/__tests__/integration/`)

- Bridge ↔ agent-chat: start both, verify messages flow through to observer WebSocket
- chat-send.sh ↔ bridge: bash script posts arrive at bridge API
- Hook ↔ bridge: simulate PostToolUse events, verify lifecycle messages posted
- Failure modes: kill agent-chat mid-session, verify bridge queues and reconnects

### E2E Tests (`tests/e2e/`)

- `agent-chat-dashboard.spec.ts`: Open dashboard, simulate agent activity via WebSocket, verify messages render
- `cross-agent-flow.spec.ts`: Start bridge, trigger chat-send.sh calls for multiple agents, verify dashboard shows correct room with correct messages in order

### Not Tested

Agent prompt compliance (whether agents actually call chat-send.sh). Validated through manual observation during first real usage.

## File Structure

```
SubAgents/
├── services/
│   ├── agent-chat/                  # Copied from GitHub repo
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   └── server.ts
│   │   ├── public/
│   │   │   └── index.html
│   │   └── data/
│   │
│   └── chat-bridge/
│       ├── package.json
│       ├── tsconfig.json
│       ├── bridge.ts
│       ├── chat-send.sh
│       ├── profiles.ts
│       ├── verbosity.ts
│       └── __tests__/
│           ├── bridge.test.ts
│           ├── verbosity.test.ts
│           └── integration/
│               └── flow.test.ts
│
├── commands/                        # Modified — chat block appended
│   ├── discuss.md
│   ├── research.md
│   ├── plan.md
│   ├── consult.md
│   ├── implement.md
│   ├── review.md
│   └── ship.md
│
├── hooks/
│   └── review-squad-gate.js         # Modified — lifecycle posting added
│
└── tests/e2e/
    ├── agent-chat-dashboard.spec.ts
    └── cross-agent-flow.spec.ts
```

**Changes summary:**
- **New:** `services/agent-chat/`, `services/chat-bridge/`, `tests/e2e/` test files
- **Modified:** 7 command files (chat block addition), 1 hook file (lifecycle posting)
- **Unchanged:** All 6 agent definition files in `agents/`

## Future Considerations (v2)

- **User-to-agent messaging:** WebSocket infrastructure supports it. Would require agents to poll or check for messages at defined checkpoints during execution.
- **Agent avatars:** Profile system supports image upload. Could generate or assign per-agent avatars.
- **Room persistence:** agent-chat transcripts already persist to `data/transcripts/`. Could integrate with PM Cory's `.review-squad/` memory for cross-session chat history.
- **Dashboard enhancements:** Custom dashboard UI showing agent roles, current phase, verbosity controls.
