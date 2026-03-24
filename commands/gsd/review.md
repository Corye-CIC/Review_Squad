---
name: gsd:review
description: Run the Review Squad (FC, Jared, Stevey Boy Choi, PM Cory, Nando, Emily) on a phase's changed files before testing
argument-hint: "<phase-number>"
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
Run the 6-agent Review Squad on all files changed during a GSD phase. This slots between execution and verification — code must pass review before testing.

The squad:
1. **Father Christmas** — Code quality + novel approaches
2. **Jared** — Security, efficiency, systems reuse
3. **Stevey Boy Choi** — UX/UI, frontend performance, accessibility (frontend) + microservices connectivity, data pathway efficiency, resilience (always)
4. **PM Cory** — PM, creative challenger, persistent memory agent
5. **Nando** — Lead reviewer, synthesizes all outputs, delivers technical verdict
6. **Emily** — Final reviewer: runs E2E validation tests, pressure tests features, verifies plan adherence, accessibility compliance, and UX intent
</objective>

<context>
Phase: $ARGUMENTS (required — e.g., "49" or "49-search-enhancement")
</context>

<process>

## Step 1: Identify changed files

Determine the phase directory and find all files changed during this phase's execution.

```bash
# Validate PHASE_ARG before first use
PHASE_NUM="${PHASE_ARG%%[-_]*}"
[[ "$PHASE_NUM" =~ ^[0-9]+$ ]] || { echo "Invalid phase number: $PHASE_NUM"; exit 1; }

# Find the phase directory
PHASE_DIR=$(find .planning/phases/ -maxdepth 1 -type d -name "${PHASE_ARG}*" 2>/dev/null | head -1)
```

Get changed files from git commits associated with this phase:

```bash
# Find commits for this phase (exclude docs/planning commits)
# --all-match requires BOTH --grep patterns to match (phase number AND commit type)
# --grep="(${PHASE_NUM}" matches conventional commit scope format: feat(49): description
git log --oneline --all \
  --grep="(${PHASE_NUM}" \
  --grep="feat|fix|refactor|style|perf" \
  --extended-regexp \
  --all-match \
  --format="%H" | while read sha; do
  git diff-tree --no-commit-id --name-only -r "$sha"
done | sort -u | grep -v "^\.planning/"
```

If no commits found, fall back to checking git diff against the phase's start point, or ask the user which files to review.

Store the file list as `CHANGED_FILES`.

Determine if any frontend files are in the changeset. Use the same frontend detection rules as `/review`: files in `frontend/`, `src/components/`, `src/pages/`, `public/`, or with extensions `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`.

## Step 2: Load PM Cory's persistent context

```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
```

If `${SQUAD_DIR}` doesn't exist, create the directory structure (PM Cory will handle this, but ensure it's there).

Also check for Emily's prior phase outputs:
```bash
PLAN_PATH="${SQUAD_DIR}/current-plan.md"
DISCUSSION_PATH="${SQUAD_DIR}/current-discussion.md"
RESEARCH_PATH="${SQUAD_DIR}/current-research.md"
```

If each path exists, read the file and store its contents as `plan_content`, `discussion_content`, `research_content` respectively. Pass the file contents (not the paths) to Emily's prompt.

## Step 3: Spawn reviewers in parallel

Spawn FC, Jared, Stevey Boy Choi, and PM Cory in parallel. Stevey always participates (connectivity hat is always on; frontend hat activates when frontend files are present).

For each agent, provide:
- The list of changed files to review
- The project context (what the phase was supposed to accomplish — from ROADMAP.md or the plan files)
- Instructions to read each file before forming opinions

**Agent prompts must include:**
```
Review the following files changed in Phase {PHASE_NUM} ({phase_name}):

{CHANGED_FILES list}

Phase goal: {goal from ROADMAP.md}

Read every file listed above using the Read tool before forming your review.
For context, you may also read related files that are imported or referenced by the changed files.

Working directory: {cwd}
```

For PM Cory, additionally include:
```
Load persistent context from: {SQUAD_DIR}/
After your review, update the persistent knowledge files with new learnings.
```

## Step 4: Collect outputs

Wait for all parallel agents to complete. Collect their review outputs.

## Step 5: Spawn Nando

Spawn Nando with all review outputs concatenated:

```
You are reviewing Phase {PHASE_NUM} ({phase_name}).

Here are the review outputs from your squad:

=== FATHER CHRISTMAS ===
{fc_output}

=== JARED ===
{jared_output}

=== STEVEY BOY CHOI ===
{stevey_output}

=== PM CORY ===
{pm_cory_output}

Changed files:
{CHANGED_FILES}

Working directory: {cwd}

Synthesize these reviews into your final consolidated verdict.
Read any files flagged by multiple reviewers or with conflicting recommendations.
```

## Step 6: Spawn Emily (Final Review)

After Nando completes, spawn `emily` in **review mode** with:
- Nando's consolidated verdict
- All agent review outputs
- The plan from `.review-squad/<project-name>/current-plan.md` (if it exists)
- The discussion and research files (if they exist)
- The phase goal and requirements from ROADMAP.md

Emily's prompt:
```
You are performing your final review of Phase {PHASE_NUM} ({phase_name}) after Nando's technical verdict.
This includes E2E feature validation and pressure testing — not just code review.

=== NANDO — Consolidated Review ===
{nando_output}

=== AGENT REVIEWS (for reference) ===
FC: {fc_output}
Jared: {jared_output}
Stevey: {stevey_output}
PM Cory: {pm_cory_output}

{If plan exists:}
=== EMILY — Implementation Plan (from /plan phase) ===
{plan_content}

{If discussion exists:}
=== EMILY — Discussion Summary (from /discuss phase) ===
{discussion_content}

{If research exists:}
=== EMILY — Research Findings (from /research phase) ===
{research_content}

Phase goal: {goal from ROADMAP.md}
Changed files: {CHANGED_FILES}
Working directory: {cwd}
PM Cory persistent context: {SQUAD_DIR}/

Perform your final review:
1. Run any automated validation tests you created during /implement
   (Playwright, Jest, etc.). Report pass/fail with evidence.
2. Walk through your manual validation checklists against the actual
   implementation. Report pass/fail per item.
3. Execute your pressure test scenarios. Document observed behavior.
4. Check plan adherence, research alignment, requirements coverage,
   accessibility compliance, and UX intent.
5. Deliver your CONFIRM or CHALLENGE verdict. Test failures carry the
   same weight as plan adherence issues — failing tests mean CHALLENGE.

If no tests were created during /implement, design and run validation
checks now based on the changed files and any available plan/criteria.

If no plan/discussion/research exists, note this gap and provide a
lighter-touch review focused on accessibility, UX intent, and
feature-level validation of the changed code.
```

Emily runs E2E tests, pressure tests features, checks plan adherence, research alignment, requirements coverage, accessibility compliance, and UX intent. Test failures are findings that factor into her CONFIRM or CHALLENGE verdict.

## Step 7: Present verdict

Display Nando's consolidated review followed by Emily's final review.

**If Nando APPROVE + Emily CONFIRM:**
```
## Review Squad: APPROVED

Phase {X} code passed review. Emily confirms plan adherence.
Ready for verification.

Next: `/gsd:verify-work {X}`
```

**If Nando APPROVE + Emily CHALLENGE:**
```
## Review Squad: APPROVED (with challenges)

{Nando's approval}

### Emily's Challenges
{Emily's items for consideration}

Address Emily's challenges, then: `/gsd:verify-work {X}`
```

**If Nando REVISE:**
```
## Review Squad: REVISE

{Nando's required changes list}
{Emily's plan adherence notes, if applicable}

Fix the items above, then re-run: `/gsd:review {X}`
```

**If Nando BLOCK:**
```
## Review Squad: BLOCKED

{Nando's blockers list}
{Emily's accessibility/plan blockers, if applicable}

These must be resolved before proceeding. Fix and re-run: `/gsd:review {X}`
```

</process>

<success_criteria>
- [ ] All changed files identified from phase commits
- [ ] FC, Jared, Stevey, PM Cory spawned in parallel
- [ ] All agents completed their reviews
- [ ] Nando synthesized a consolidated verdict
- [ ] Emily ran E2E validation tests (automated and/or manual)
- [ ] Emily executed pressure test scenarios
- [ ] Emily verified plan adherence, accessibility, and UX intent
- [ ] Test results included in Emily's verdict
- [ ] PM Cory updated persistent knowledge files
- [ ] Combined verdict presented with clear next steps
</success_criteria>
