---
name: review-auto
description: Run /review, auto-apply safe fixes for trivial findings, re-review, and surface remaining items. Up to 2 iterations.
argument-hint: "[same as /review, plus --max-iterations N (default 2)]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
<objective>
Compress the Review Squad's `/review` → fix → re-review loop. Run `/review`, classify findings by risk AND by source reviewer, dispatch the squad's own implement agents to apply low-risk fixes under strict validation gates, re-run the squad, and surface everything that still needs human judgment. Never silently ship ambiguous changes.

This is the closed-loop enhancement proposed in the insights report. It is deliberately conservative — it only automates fixes where the cost of getting it wrong is low and recovery is trivial.

**Squad integration:** This command is a first-class participant in the squad lifecycle (`/discuss` → `/research` → `/plan` → `/consult` → `/implement` → `/review` → `/review-auto` → `/ship`). It reuses squad conventions:
- Implement agents (father-christmas-implement, jared-implement, stevey-boy-choi-implement, nando-implement) are the workers — not generic anonymous subagents
- Findings are attributed to the source reviewer (FC, Jared, Stevey, PM Cory) so the matching implement agent applies the fix
- Each iteration is appended to `.review-squad/<project>/review-history.md` as a round-N entry
- PM Cory's persistent agent-notes receive the auto-fix patterns so recurring NIT classes get surfaced as plan-time warnings next cycle
- The final re-review uses the normal `/review` flow; `/ship`'s review gate accepts the post-auto-fix verdict because the gate reads `review-history.md` directly
</objective>

<context>
$ARGUMENTS — optional. Same as `/review` (file paths, git ref, `--pr <N>`, `--skip-preflight`) plus:
- `--max-iterations <N>` — cap the fix-review loop (default: 2, max: 3)
- `--dry-run` — classify findings and report what would be auto-fixed, but do not apply changes
</context>

<process>

## Step 1: Initial review

Invoke `/review $ARGUMENTS` (without the `--max-iterations` and `--dry-run` flags — strip those before passing through).

Record the verdict. If the verdict is APPROVE + CONFIRM, exit with:
`"Review passed on first pass. No auto-fix needed."`

## Step 2: Classify findings (tier + source reviewer + implement agent)

If verdict is REVISE or BLOCK, parse Nando's consolidated verdict and the individual agent outputs (FC, Jared, Stevey, PM Cory) into a list of findings. For each finding, record:
- **Tier** (NIT / MUST-FIX-SAFE / MUST-FIX-RISKY / BLOCKER)
- **Source reviewer** (fc / jared / stevey / pm-cory / nando-synthesized)
- **Target implement agent** (the squad member best suited to apply the fix)

**Tier classification rules:**

**NIT (auto-fixable):**
- Formatting only (prettier, lint --fix territory)
- Missing return statements in void-returning handlers
- Unused imports / unused variables
- Missing `const` / `let` where appropriate
- Single-file changes with no behavioral implication

**MUST-FIX-SAFE (auto-fixable, tighter constraints):**
- Missing null/undefined guards on known-nullable values
- Missing `await` on promises where the return type is already correctly typed
- Single-file, no API surface change, no test change required

**MUST-FIX-RISKY / BLOCKER (always surface to user):**
- Anything touching auth, permissions, migrations, or security boundaries
- Behavioral changes
- Multi-file changes
- Anything flagged by `jared-review` as security-adjacent
- Anything where the reviewer expressed uncertainty ("consider", "might", "perhaps")
- Type-signature changes that affect callers
- Database schema changes

If uncertain, classify as MUST-FIX-RISKY. Default to surfacing, not automating.

**Source-reviewer → implement-agent mapping:**

| Source reviewer | Target implement agent | Rationale |
|-----------------|------------------------|-----------|
| `father-christmas-review` | `father-christmas-implement` | Code quality, naming, design, DRY/SOLID |
| `jared-review` (NIT only) | `jared-implement` | Security-adjacent NIT like unused imports in auth modules |
| `stevey-boy-choi-review` | `stevey-boy-choi-implement` | UX/frontend surface and service connectivity |
| `pm-cory-review` | `father-christmas-implement` | PM Cory does not implement; FC handles process/doc-level code NITs |
| `nando-review` (synthesized, cross-cutting) | `nando-implement` | Architecture-spanning fixes |

Do not route MUST-FIX-SAFE items flagged by Jared to auto-apply — force those to MUST-FIX-RISKY regardless of safety heuristics. Security-adjacent "safe" is an oxymoron in this flow.

Output a classification table:
```
| # | Finding | Tier | Source | Target agent | File(s) | Auto-fix? |
|---|---------|------|--------|--------------|---------|-----------|
| 1 | Missing null check on userId | MUST-FIX-SAFE | fc | father-christmas-implement | src/auth.ts | yes |
| 2 | Migration adds NOT NULL without backfill | BLOCKER | fc | — | migrations/0042_... | no |
| 3 | Unused import `fs` | NIT | fc | father-christmas-implement | src/utils.ts | yes |
| 4 | Button lacks aria-label | NIT | stevey | stevey-boy-choi-implement | src/components/Btn.tsx | yes |
| 5 | Token comparison uses === on raw string | MUST-FIX-RISKY | jared | — | src/auth/session.ts | no |
```

## Step 3: User gate

Display the classification table.

If `--dry-run` was passed: stop here with `"Dry run complete. 0 fixes applied."`

**Iteration 1 (always prompt):**
Use AskUserQuestion to confirm:
```
Auto-apply <n> fix(es) to <m> file(s) now? Only NIT and MUST-FIX-SAFE items will be auto-applied.

MUST-FIX-RISKY and BLOCKER items (<k>) will be surfaced for you to handle.
```

If the user declines, exit and show only the MUST-FIX-RISKY/BLOCKER items.

**Iteration 2+ (conditional prompt):**
Compare this iteration's auto-fixable list to iteration 1's. If ANY of the following is true, re-prompt:
- A new MUST-FIX-SAFE item appears that was not in iteration 1
- A file not touched in iteration 1 is about to be auto-modified
- A new MUST-FIX-RISKY or BLOCKER item appears (these will be surfaced, not applied, but the user should see the updated table)

If none of the above, proceed silently — NIT-only and already-approved items continue without re-prompting. The first-iteration approval covers these.

Track the iteration-1 approval state so iteration 2+ knows what was already sanctioned.

## Step 4: Apply auto-fixes via squad implement agents

Before dispatching, snapshot the untracked file list (for scope-violation detection on revert):
```bash
git status --porcelain | grep '^??' | awk '{print $2}' > /tmp/auto-fix-untracked-before.txt
```

### 4a. Pre-load context (squad convention)

Read each auto-fixable finding's target file once into orchestrator context. Assemble the `<injected-context>` block following the same pattern as `/review` Step 3.5:

```xml
<injected-context>
<context-meta command="/review-auto" agent="{implement-agent-name}" round="{N}" />

IMPORTANT: Target file contents are pre-loaded below. Do NOT call Read on these files — they are already in your context. Touch ONLY the file specified in your task.

<shared-files>
<file path="{target-file-path}">
{file contents verbatim}
</file>
</shared-files>

<agent-files></agent-files>
</injected-context>
```

### 4b. Dispatch via Agent tool using the mapped squad implement agent

For each auto-fixable finding, dispatch via `Agent` with `subagent_type=<target agent>` from the mapping table in Step 2. Workers run in parallel.

Worker prompt template:
```
Context is pre-loaded in <injected-context> below. Do not re-read files already present.

{injected-context block with agent="{target-agent}", round="{N}"}

You are applying a single specific fix identified by the Review Squad. You are the implement-mode counterpart of the reviewer who flagged this item (source: {source-reviewer}). Apply the fix within your domain discipline — do not extend scope into other agents' territory.

Constraints (hard):
1. Make ONLY the minimum change needed to resolve this specific item. Do not refactor. Do not touch unrelated code. Do not add tests. Do not create new files.
2. Change ONE file only: {target-file}
3. If resolving this finding requires touching any other file, abort and return exactly: "REQUIRES MULTI-FILE CHANGE"
4. If you cannot locate the section or line referenced in the finding, abort and return exactly: "EDIT TARGET NOT FOUND"
5. If you hit an unexpected error, abort and return exactly: "UNEXPECTED ERROR: <one-line description>"
6. On success, return exactly: "SUCCESS: <one-line summary of the change>"

<file-scope>
Edit ONLY: {target-file}
</file-scope>

Finding to fix (round {N}, source: {source-reviewer}):
{finding description verbatim from Nando's consolidated verdict}

Nando's severity: {tier}
PM Cory persistent context: .review-squad/{project-name}/agent-notes/
```

### 4c. Collect results

For any worker that returned anything other than `SUCCESS:`:
- Reclassify that finding as MUST-FIX-RISKY for this round
- Do not count it as auto-applied
- Log the worker's non-SUCCESS return string for the surface-to-user summary
- Continue — other workers may still have succeeded

For every worker that returned `SUCCESS:`, record:
- The target agent that applied the fix
- The source reviewer that flagged it
- The one-line summary (for the commit message and review-history round entry)

## Step 5: Validation gate

After all workers return, before any commit:

```bash
# 5.1 — Scope check: new untracked files are a violation
git status --porcelain | grep '^??' | awk '{print $2}' > /tmp/auto-fix-untracked-after.txt
NEW_UNTRACKED=$(comm -13 <(sort /tmp/auto-fix-untracked-before.txt) <(sort /tmp/auto-fix-untracked-after.txt))
if [ -n "$NEW_UNTRACKED" ]; then
  echo "Worker created new files (scope violation): $NEW_UNTRACKED"
  # Delete only the new untracked files (safe — they did not exist before)
  echo "$NEW_UNTRACKED" | xargs -r rm -f
  # Also revert modifications
  git checkout -- .
  exit 1
fi

# 5.2 — File count limit
CHANGED=$(git diff --name-only | wc -l)
if [ "$CHANGED" -gt 10 ]; then
  echo "Auto-fix touched $CHANGED files. Limit is 10. Reverting."
  git checkout -- .
  exit 1
fi

# 5.3 — Typecheck with 5-minute safety timeout
timeout 300 pnpm typecheck 2>&1 | tee /tmp/auto-fix-typecheck.log
TYPECHECK_EXIT=${PIPESTATUS[0]}
# Exit 124 means timeout triggered — treat as failure
if [ "$TYPECHECK_EXIT" -eq 124 ]; then
  echo "Typecheck exceeded 5-minute timeout. Reverting."
fi

# 5.4 — Lint with 2-minute safety timeout
timeout 120 pnpm lint 2>&1 | tee /tmp/auto-fix-lint.log
LINT_EXIT=${PIPESTATUS[0]}
if [ "$LINT_EXIT" -eq 124 ]; then
  echo "Lint exceeded 2-minute timeout. Reverting."
fi
```

If typecheck or lint failed (including timeout):
- Display the failing output (first 20 lines)
- Revert ALL auto-fix changes: `git checkout -- <file>` for each file touched, plus `rm -f` any new untracked files detected in 5.1
- Surface the original findings (un-fixed) plus a note that auto-fix was attempted and reverted, with the failure reason (typecheck fail / lint fail / timeout / scope violation)
- Exit

Never proceed past a failing validation gate.

## Step 6: Commit auto-fix batch

If validation passed, commit the auto-fix batch as a dedicated commit (not mixed with user work):

```bash
PROJECT_NAME=$(basename "$(pwd)")
git add <only the files touched by workers>
git commit -m "chore(auto-fix): apply review squad items (round {N})

Items applied:
- [fc] Added null guard on userId at line 42 (src/auth.ts)
- [stevey] Added aria-label to primary button (src/components/Btn.tsx)
- ...

Auto-applied via /review-auto. Prior verdict: <REVISE|BLOCK>. Re-review follows.
Squad context: .review-squad/${PROJECT_NAME}/review-history.md"
```

Never force-push. Never amend. Create a new commit so the audit trail is clean.

## Step 6.5: Log round to review-history.md (squad integration)

Append a round entry to `.review-squad/<project>/review-history.md`:

```markdown
## <YYYY-MM-DD HH:MM> — /review-auto round {N}
**Trigger:** /review-auto invoked after <prior-verdict>
**Items auto-applied:** {count} (NIT: X, MUST-FIX-SAFE: Y)
**Items surfaced:** {count} MUST-FIX-RISKY, {count} BLOCKER
**Workers dispatched:** {comma-separated implement agent list}
**Worker outcomes:**
- father-christmas-implement: {n} SUCCESS, {m} MULTI-FILE, {k} NOT-FOUND
- jared-implement: {n} SUCCESS, ...
- stevey-boy-choi-implement: ...
**Commit:** {sha} chore(auto-fix): apply review squad items (round {N})
**Validation:** typecheck PASS, lint PASS, files-changed {n}, untracked-delta 0
**Next:** re-running /review (iteration {N+1} of {max})
```

This ties the auto-fix run into the same history `/ship` reads at its review gate. The gate accepts post-auto-fix verdicts without flagging them as stale.

## Step 6.6: Persist patterns to PM Cory's agent-notes (squad integration)

Append to `.review-squad/<project>/agent-notes/pm-cory.md` (or `learnings.jsonl` if the project uses structured logs):

```markdown
### Auto-fix pattern (round {N}, {date})
Classes of NITs that surfaced this round:
- {NIT class}: {count} occurrence(s) across {file count} file(s)
- {MUST-FIX-SAFE class}: {count}

Recurring patterns flagged (appear in 2+ rounds this cycle):
- {pattern} — suggest adding to plan-time warnings for next cycle
```

Next time PM Cory participates in `/plan` or `/consult`, these patterns appear in persistent context, letting the squad preempt them before code is written.

## Step 7: Re-review

Invoke `/review $ARGUMENTS` again.

Parse the new verdict.

**If APPROVE + CONFIRM:**
Report:
```
## Auto-fix loop: SUCCESS

Applied <n> fix(es) in 1 iteration.
Final verdict: APPROVE + CONFIRM.

Commit: <sha> chore(auto-fix): ...
```

**If still REVISE/BLOCK AND iterations remaining (< max-iterations):**
Return to Step 2 with the new verdict. Cap enforced.

**If still REVISE/BLOCK AND iteration cap reached:**
Report:
```
## Auto-fix loop: INCOMPLETE

Applied <n> fix(es) across <k> iteration(s). Verdict still <REVISE|BLOCK>.

Remaining items (surfaced for human judgment):
<filtered list of MUST-FIX-RISKY and BLOCKER items>

Next action: review the remaining items, apply the fixes manually, then re-run /review.
```

## Step 8: Safeguards (enforced throughout)

- NEVER modify files under `migrations/` or `db/migrations/` — always classify as BLOCKER
- NEVER modify files matching `*.env*`, secrets, or credentials — always classify as BLOCKER
- NEVER force-push, never amend, never `git reset --hard`
- NEVER touch `package.json` dependencies — always classify as MUST-FIX-RISKY
- If more than 10 files change in a single iteration, abort and revert
- If any worker returns `"REQUIRES MULTI-FILE CHANGE"`, reclassify that finding as MUST-FIX-RISKY and do not auto-apply

</process>

<success_criteria>
- [ ] Initial /review run completed
- [ ] Findings classified by tier AND by source reviewer AND mapped to target implement agent
- [ ] Jared-flagged items never auto-applied (forced to MUST-FIX-RISKY)
- [ ] Workers dispatched via squad implement agents (father-christmas-implement, jared-implement, stevey-boy-choi-implement, nando-implement) — not generic subagents
- [ ] Worker prompts use the squad's injected-context + file-scope pattern
- [ ] User confirmed before any auto-apply (unless dry-run)
- [ ] Iteration 2+ re-prompts on new risky items or new file targets
- [ ] Validation gate enforced (timeout-guarded typecheck + lint + <=10 files + no new untracked)
- [ ] Worker non-SUCCESS returns handled (MULTI-FILE, NOT FOUND, UNEXPECTED ERROR all reclassify)
- [ ] Auto-fix commit separate from user work, references round number + prior verdict
- [ ] Round appended to `.review-squad/<project>/review-history.md` so `/ship` gate reads it
- [ ] Patterns persisted to PM Cory agent-notes for next-cycle preemption
- [ ] Iteration cap respected (default 2, max 3)
- [ ] Remaining risky items surfaced with explicit "surfaced for human judgment" framing
- [ ] Never touched migrations, secrets, or package.json dependencies
</success_criteria>
