---
name: ship
description: Final Review Squad shipping workflow for presentation generation, PR preparation, CI monitoring, and failure follow-up.
---

Use this skill when the user explicitly wants to ship the branch.

Start by running:

```bash
scripts/review-squad/ensure-squad-state.sh
scripts/review-squad/ship-prepare.sh "<optional title>"
```

`ship-prepare.sh` creates:
- `.review-squad/<project-name>/ship/ship-summary.json`
- `.review-squad/<project-name>/ship/ship-presentation.html`
- `.review-squad/<project-name>/ship/pr-body.md`

Workflow:
1. Verify recent review state and confirm the branch is ready to ship.
2. Gather summary context from git history, changed files, and `.review-squad/` artifacts.
3. Review and refine the generated ship artifacts instead of rebuilding them from scratch.
4. If asked and approvals allow it, create or update the PR with:

```bash
scripts/review-squad/ship-open-pr.sh "<title>" ".review-squad/<project-name>/ship/pr-body.md" "<base-branch>"
```

5. If asked and approvals allow it, check CI status with:

```bash
scripts/review-squad/ship-ci-status.sh
scripts/review-squad/ship-ci-status.sh --watch
```

6. If CI fails and the user wants fixes, route the failure to the most relevant implementer(s).

Rules:
- Do not push, create PRs, or mutate remote state without the required approvals.
- Treat review gating as real, not ceremonial.
- Keep presentation content accurate and tightly grounded in the actual diff.
- Prefer updating the generated artifacts instead of discarding them.
