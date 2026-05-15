---
name: research
description: Run the Review Squad research workflow to evaluate options, prior art, codebase patterns, and risks.
---

Use this skill when the user wants research after discussion and before planning.

Before other work, run:

```bash
scripts/review-squad/ensure-squad-state.sh
```

Workflow:
1. Load `.review-squad/<project-name>/current-discussion.md` if present, plus any focused user questions.
2. Gather `CONTEXT.md` files and other narrowly relevant local context.
3. Spawn `emily_researcher` and `pm_cory_early` in parallel.
4. Synthesize Emily's recommendations with PM Cory's codebase and memory findings.
5. Save the result to `.review-squad/<project-name>/current-research.md` when appropriate.

Output should include:
- options considered
- codebase patterns
- risks and tradeoffs
- accessibility implications
- clear recommendation
