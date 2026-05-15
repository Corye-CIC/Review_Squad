---
name: implement
description: Short alias for the Review Squad implementation workflow driven by the current implementation brief.
---

Delegate to the `review-squad-implement` workflow.

Use this skill when the user wants Review Squad implementation using the current brief.

Before other work, run:

```bash
scripts/review-squad/ensure-squad-state.sh
```

Workflow:
1. Load `.review-squad/<project-name>/current-brief.md` unless another brief is specified.
2. Resolve file ownership before edits.
3. Spawn the needed implementers plus `emily_validator`.
4. Finish with `nando_implementer` for integration checking.

If both this alias and `review-squad-implement` are available, treat them as equivalent.
