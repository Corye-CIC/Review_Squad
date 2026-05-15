---
name: review-squad-implement
description: Run the Review Squad implementation workflow using an implementation brief, with Emily handling validation and Nando checking integration.
---

Use this skill when the user wants Codex to execute work using the Review Squad structure.

Workflow:
1. Load the implementation brief from `.review-squad/<project-name>/current-brief.md` unless the user points at another brief.
2. If no brief exists, either stop and ask for consultation or run a brief inline consultation if the user explicitly wants that shortcut.
3. Resolve file ownership before edits. No two implementers should own the same file in the same wave.
4. Spawn targeted implementers based on the brief:
   - `fc_implementer`
   - `jared_implementer`
   - `stevey_implementer`
   - `pm_cory_implementer`
   - `emily_validator`
5. After implementation work finishes, spawn `nando_implementer` to check fit, interfaces, and any minimal integration glue.
6. Report what changed, what was validated, and any remaining risks.

Rules:
- Keep each subagent on a disjoint write scope whenever possible.
- Prefer the smallest defensible patch set.
- Emily focuses on tests and validation artifacts, not product code.
- PM Cory owns coordination and memory, not implementation churn.

Suggested prompts:
- `$review-squad-implement execute the current brief`
- `$review-squad-implement implement the brief in docs/briefs/login.md`
