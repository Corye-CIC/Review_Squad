---
name: consult
description: Short alias for the Review Squad consultation workflow that produces an implementation brief before coding.
---

Delegate to the `review-squad-consult` workflow.

Use this skill when the user wants Review Squad consultation before implementation.

Before other work, run:

```bash
scripts/review-squad/ensure-squad-state.sh
```

Workflow:
1. Gather focused project context.
2. Spawn `fc_consultant`, `jared_consultant`, `stevey_consultant`, and `pm_cory_consultant` in parallel.
3. Synthesize with `nando_consultant`.
4. Save the resulting brief to `.review-squad/<project-name>/current-brief.md` when appropriate.

If both this alias and `review-squad-consult` are available, treat them as equivalent.
