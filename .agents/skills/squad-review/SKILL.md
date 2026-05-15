---
name: squad-review
description: Short alias for the Review Squad multi-agent review workflow.
---

Delegate to the `review-squad-review` workflow.

Use this skill when the user wants Review Squad review of a diff, branch, or file set.

Workflow:
1. Determine the review scope.
2. Spawn the specialist reviewers in parallel.
3. Synthesize with `nando_reviewer`.
4. Final-check with `emily_reviewer`.

If both this alias and `review-squad-review` are available, treat them as equivalent.
