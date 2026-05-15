---
name: review-squad-review
description: Run the Review Squad review workflow by spawning specialist reviewers, then synthesizing with Nando and final-checking with Emily.
---

Use this skill when the user wants a multi-agent review of current changes, specific files, or a diff against a git ref.

Before other work, run:

```bash
scripts/review-squad/ensure-squad-state.sh
```

Workflow:
1. Determine review scope from the user request.
2. Explain the route before spawning agents. Prefer:

```bash
scripts/review-squad/explain-review-route.js --json
```

   If a calibration summary exists, include it:

```bash
scripts/review-squad/explain-review-route.js --json --calibration .review-squad/Review_Squad/calibration-summary.json
```

3. Read only the files needed for that scope. Prefer exact files or `git diff --name-only`.
4. Spawn reviewer agents in parallel according to the route:
   - `fc_reviewer`
   - `jared_reviewer`
   - `stevey_reviewer`
   - `pm_cory_reviewer`
5. If the route is thin-mode, you may skip `stevey_reviewer` and `pm_cory_reviewer`.
6. Before Nando synthesis, send high-risk findings through `neutral_verifier`:
   - security
   - auth, session, permissions, tenant isolation
   - migration, schema, data loss
   - critical correctness
   - broad refactor regression
   - accessibility blocker
7. Wait for reviewer and verifier outputs, then spawn `nando_reviewer` with the collected findings, verifier decisions, routing note, and the file list.
8. Spawn `emily_reviewer` after Nando with:
   - Nando's verdict
   - reviewer outputs
   - verifier outputs
   - routing note
   - any available plan, research, or discussion notes from `.review-squad/`
9. Return findings first. Summaries come after findings.

Rules:
- Keep review file-scoped. Do not broaden scope without evidence.
- Review agents should not edit files.
- Persona confidence is not evidence. High-risk claims need neutral verification before becoming blockers.
- Include a routing note in the final response: mode, agents included/skipped, verifier used/skipped, telemetry hints, and why.
- Emily may run targeted tests when that materially improves the review.
- If the user asks for a "review", default to this skill.

Suggested prompts:
- `$review-squad-review review this branch against main`
- `$review-squad-review review src/auth.ts and src/routes/session.ts`
