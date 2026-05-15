---
name: audit
description: Run a deep Review Squad audit across the codebase or a focused subsystem for security, systems, schema, and architectural debt.
---

Use this skill when the user wants a deep audit rather than a PR-style review.

Before other work, run:

```bash
scripts/review-squad/ensure-squad-state.sh
```

Workflow:
1. Determine audit scope from the user request.
2. Gather focused context and representative files for that scope.
3. Spawn `fc_auditor` and `jared_auditor` in parallel.
4. Synthesize with `nando_reviewer`.
5. Optionally persist the results into `.review-squad/<project-name>/` memory files.

Output should include:
- Critical
- High
- Medium
- Low
- Highlights
