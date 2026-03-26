---
name: agent-chat:off
description: Stop the agent-chat server if it is running. Prompts to save the chat log as markdown before stopping. Safe to run if not running — reports status and exits cleanly.
argument-hint: ""
allowed-tools:
  - Bash
---
<objective>
Gracefully stop the agent-chat server. Before stopping, fetch the chat log and offer to save it as markdown. Read the PID file, verify the process is alive, send SIGTERM, wait for clean exit, and clean up.
</objective>

<process>

## Step 1 — Find the process

```bash
PID_FILE="/tmp/agent-chat.pid"
```

If `$PID_FILE` does not exist:
```
agent-chat is not running (no PID file found).
```
Stop.

```bash
PID="$(cat "$PID_FILE" 2>/dev/null || echo "")"
```

If `PID` is empty or `kill -0 "$PID" 2>/dev/null` fails:
```
agent-chat is not running (PID file exists but process $PID is gone).
```
Remove the stale PID file: `rm -f "$PID_FILE"`
Stop.

## Step 2 — Fetch and offer to save the chat log

```bash
EXPORT="$(curl -sf --max-time 2 "http://127.0.0.1:4001/export" || echo "")"
```

Parse the message count and room name from the export header:
```bash
MSG_COUNT="$(echo "$EXPORT" | grep '^\*\*Messages:\*\*' | grep -o '[0-9]*')"
ROOM="$(echo "$EXPORT" | grep '^\*\*Room:\*\*' | sed 's/\*\*Room:\*\* //')"
```

If `MSG_COUNT` is empty or 0, skip the save prompt and proceed to Step 3.

If `MSG_COUNT` > 0:

Resolve a default save path. Use the current git repo root if available:
```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME")"
DATE_STR="$(date +%Y-%m-%d-%H%M)"
SAFE_ROOM="$(echo "$ROOM" | tr '/' '-' | tr ' ' '-')"
DEFAULT_PATH="${REPO_ROOT}/.review-squad/agent-chat-${SAFE_ROOM}-${DATE_STR}.md"
```

Ask the user: **"Save chat log? ($MSG_COUNT messages, room: $ROOM). Save to $DEFAULT_PATH? (yes / no / custom path)"**

- **yes** — save to `$DEFAULT_PATH`
- **no** — skip
- **custom path** — save to the path the user provides

To save:
```bash
mkdir -p "$(dirname "$SAVE_PATH")"
printf '%s\n' "$EXPORT" > "$SAVE_PATH"
```
Confirm: `Chat log saved to $SAVE_PATH`

## Step 3 — Stop the server

```bash
kill "$PID"
```

Wait up to 5 seconds for the process to exit (50 × 100ms):

```bash
STOPPED=false
for i in $(seq 1 50); do
  if ! kill -0 "$PID" 2>/dev/null; then
    STOPPED=true
    break
  fi
  sleep 0.1
done
```

If `STOPPED=false` after timeout, send SIGKILL:
```bash
kill -9 "$PID" 2>/dev/null || true
```
Then print: `agent-chat (PID $PID) did not exit cleanly — force-killed.`

## Step 4 — Clean up and report

```bash
rm -f "$PID_FILE"
```

If stopped cleanly:
```
agent-chat stopped (PID $PID).
```

</process>

<success_criteria>
- [ ] Reports cleanly if not running — no error, no crash
- [ ] Fetches log from GET /export before stopping
- [ ] Skips save prompt if no messages
- [ ] Prompts with message count, room name, and default path when messages exist
- [ ] Accepts yes / no / custom path response
- [ ] Saves markdown to chosen path, creating parent directories as needed
- [ ] Sends SIGTERM for graceful shutdown; falls back to SIGKILL after 5s
- [ ] Removes /tmp/agent-chat.pid on exit
- [ ] Reports save path and stop outcome
</success_criteria>
