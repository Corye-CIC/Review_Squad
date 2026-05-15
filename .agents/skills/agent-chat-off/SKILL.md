---
name: agent-chat-off
description: Stop the Review Squad agent-chat server and preserve the auto-saved chat log when appropriate.
---

Use this skill when the user wants to stop the local agent-chat service.

Workflow:
1. By default, run:

```bash
scripts/review-squad/agent-chat-off.sh
```

2. If the user wants the log copied automatically, run one of:

```bash
scripts/review-squad/agent-chat-off.sh --copy-default
scripts/review-squad/agent-chat-off.sh --copy "<path>"
```

3. Report where the log was preserved, if applicable.
