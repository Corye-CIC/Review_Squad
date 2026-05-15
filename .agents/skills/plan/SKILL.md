---
name: plan
description: Run the Review Squad planning workflow to build a phased implementation plan with scope, dependencies, validation, and accessibility.
---

Use this skill when the user wants a concrete implementation plan before consultation or coding.

Before other work, run:

```bash
scripts/review-squad/ensure-squad-state.sh
```

Workflow:
1. Load current discussion and research artifacts from `.review-squad/<project-name>/` when available.
2. Gather focused local context such as `CONTEXT.md`.
3. Spawn `emily_planner` and `pm_cory_early` in parallel.
4. Synthesize the result into a unified implementation plan.
5. Save it to `.review-squad/<project-name>/current-plan.md` when appropriate.

Output should include:
- phases and deliverables
- in-scope / out-of-scope / deferred
- dependencies and coordination risks
- accessibility checklist
- success criteria
