---
name: review-squad-consult
description: Run the Review Squad consultation workflow to produce an implementation brief before coding.
---

Use this skill when the user wants the squad to design the approach before implementation.

Workflow:
1. Gather focused context for the requested feature.
2. Prefer existing `CONTEXT.md` files and any `.review-squad/current-*.md` artifacts before broader exploration.
3. Spawn in parallel:
   - `fc_consultant`
   - `jared_consultant`
   - `stevey_consultant`
   - `pm_cory_consultant`
4. Wait for their briefs.
5. Spawn `nando_consultant` with the task, gathered context, and all four outputs.
6. Save the result to `.review-squad/<project-name>/current-brief.md` when appropriate.
7. Present the implementation brief with ownership, sequencing, interfaces, and open questions.

Rules:
- Optimize for a brief that implementers can execute without ambiguity.
- If there is an existing Emily plan or research output, treat it as authoritative input unless the user asks to replace it.
- Do not start implementation inside this skill unless the user explicitly asks for it.

Suggested prompts:
- `$review-squad-consult design the approach for adding OAuth login`
- `$review-squad-consult use docs/spec.md and produce an implementation brief`
