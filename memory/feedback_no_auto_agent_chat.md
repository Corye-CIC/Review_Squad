---
name: Do not auto-start agent-chat server in squad commands
description: agent-chat:on must never be invoked automatically during consult, implement, or other squad commands
type: feedback
---

Do NOT invoke the `agent-chat:on` skill (or start the agent-chat server at ports 4000/4001) automatically when running squad commands like `/consult`, `/implement`, `/review`, etc.

**Why:** The user explicitly designed the chat server as an optional transparency overlay. Starting it automatically removes that choice and adds unwanted overhead on every squad run.

**How to apply:** 
- `init-session.sh` auto-starting the chat-bridge (port 4002) is fine — that is required for `csend` routing.
- The agent-chat server (ports 4000/4001, the dashboard) is the user's opt-in. Only start it when the user explicitly runs `/agent-chat:on`.
- If a squad command skill is invoked and `agent-chat:on` is available as a skill, do NOT invoke it unless the user specifically asks.
