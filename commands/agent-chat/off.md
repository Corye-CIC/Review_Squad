---
name: agent-chat:off
description: Stop the agent-chat server if it is running. Safe to run if not running — reports status and exits cleanly.
argument-hint: ""
allowed-tools:
  - Bash
---
<objective>
Gracefully stop the agent-chat server. Read the PID file, verify the process is alive, send SIGTERM, wait for clean exit, and confirm the ports are free.
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

## Step 2 — Stop the server

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

## Step 3 — Clean up and report

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
- [ ] Sends SIGTERM for graceful shutdown; falls back to SIGKILL after 5s
- [ ] Removes /tmp/agent-chat.pid on exit
- [ ] Reports clean stop or force-kill outcome
</success_criteria>
