---
name: review
description: Run the Review Squad on changed files in the current session or working tree
argument-hint: "[file paths or git ref, e.g., 'HEAD~3' or 'src/auth.ts src/db.ts']"
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
```bash
source "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)/services/chat-bridge/init-session.sh" "review" "$*"
```
<objective>
Run the 6-agent Review Squad on changed files. Works in any project — GSD or not.

The squad: `father-christmas-review`, `jared-review`, `stevey-boy-choi-review`, `pm-cory-review` (parallel) → `nando-review` (synthesis) → `emily-review` (final).
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: Reviews all uncommitted changes (staged + unstaged)
- File paths: Reviews specific files (e.g., "src/auth.ts src/routes/api.ts")
- Git ref: Reviews changes since a ref (e.g., "HEAD~3" or "main..HEAD")
</context>

<process>

## Step 1: Determine files to review

**If $ARGUMENTS is empty:**
```bash
# All modified/added files (staged + unstaged + untracked)
git diff --name-only HEAD 2>/dev/null
git diff --name-only --cached 2>/dev/null
git ls-files --others --exclude-standard 2>/dev/null
```
Deduplicate and filter out non-source files (.planning/, e2e/, .review-squad/, node_modules/, etc.)

**If $ARGUMENTS looks like file paths** (contains `/` or `.`):
Use the listed files directly.

**If $ARGUMENTS looks like a git ref** (e.g., HEAD~3, main..HEAD, a commit SHA):
```bash
git diff --name-only $ARGUMENTS
```

If no files found, tell the user and exit.

## Step 2: Classify files

Separate into:
- **Backend/general files** — reviewed by FC, Jared, PM Cory, Stevey (connectivity hat)
- **Frontend files** — Stevey also applies frontend hat
  Frontend detection: files in `frontend/`, `src/components/`, `src/pages/`, `public/`, or with extensions `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`

Note: Stevey always participates. Frontend files activate his frontend hat. His connectivity hat (microservices data pathways, redundant calls, service integration) is always on.

## Step 3: Load PM Cory's persistent context

```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
mkdir -p "${SQUAD_DIR}/agent-notes"
```

Ensure `.review-squad/` is in `.gitignore`. If not, add it.

Also check for Emily's prior phase outputs:
```bash
PLAN_PATH="${SQUAD_DIR}/current-plan.md"
DISCUSSION_PATH="${SQUAD_DIR}/current-discussion.md"
RESEARCH_PATH="${SQUAD_DIR}/current-research.md"
```

## Step 4: Spawn reviewers in parallel

Spawn the following agents in parallel using the Agent tool:

**Always spawn:**
- `father-christmas-review` — with all changed files
- `jared-review` — with all changed files
- `stevey-boy-choi-review` — with all changed files (connectivity hat always on; if frontend files present, note which files activate his frontend hat too)
- `pm-cory-review` — with all changed files + SQUAD_DIR path for persistent memory

Each agent prompt must include:
- The complete list of files to review
- Working directory path
- Brief context on what the changes are for (from git log or user description)
- Instruction to Read every file before reviewing

## Step 5: Spawn Nando

After all parallel agents complete, spawn `nando-review` with all their outputs concatenated.

Nando receives:
- All agent outputs
- The file list
- Instructions to read any files flagged by multiple reviewers

## Step 6: Spawn Emily (Final Review)

After Nando completes, spawn `emily-review` with:
- Nando's consolidated verdict
- All agent review outputs
- The plan from `.review-squad/<project-name>/current-plan.md` (if it exists)
- The discussion from `.review-squad/<project-name>/current-discussion.md` (if it exists)
- The research from `.review-squad/<project-name>/current-research.md` (if it exists)
- Any test files she created during `/implement` (check test directories for her `.spec.ts` files or validation checklists)

Emily's prompt:
```
You are performing your final review after Nando's technical verdict.
This includes E2E feature validation and pressure testing — not just code review.

=== NANDO — Consolidated Review ===
{nando_output}

=== AGENT REVIEWS (for reference) ===
FC: {bbc_output}
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

Changed files: {file_list}
Working directory: {cwd}

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

{editCount} file(s) passed review.
Emily confirms plan adherence and accessibility compliance.
Proceed with confidence.
```

**If Nando APPROVE + Emily CHALLENGE:**
```
## Review Squad: APPROVED (with challenges)

{Nando's approval}

### Emily's Challenges
{Emily's items for consideration}

Address Emily's challenges or acknowledge them, then proceed.
```

**If Nando REVISE:**
```
## Review Squad: REVISE

{Nando's required changes}
{Emily's plan adherence notes, if applicable}

Fix the items above, then re-run: /review
```

**If Nando BLOCK:**
```
## Review Squad: BLOCKED

{Nando's blockers}
{Emily's accessibility/plan blockers, if applicable}

Resolve blockers before proceeding. Then re-run: /review
```

## Step 8: Mark review complete

The auto-fire hook automatically detects review completion. When the hook sees Emily's final verdict (CONFIRM or CHALLENGE), it sets `reviewRun: true` in the session state file, suppressing further advisories for this session.

No manual debounce step is needed -- the hook manages its own state using `data.session_id` from Claude Code's JSON input.

</process>

<success_criteria>
- [ ] Changed files identified from git or arguments
- [ ] FC, Jared, Stevey, PM Cory spawned in parallel
- [ ] All agents completed reviews
- [ ] Nando synthesized technical verdict
- [ ] Emily ran E2E validation tests (automated and/or manual)
- [ ] Emily executed pressure test scenarios
- [ ] Emily verified plan adherence, accessibility, and UX intent
- [ ] Test results included in Emily's verdict
- [ ] PM Cory persisted learnings to .review-squad/
- [ ] Combined verdict presented with clear next steps
</success_criteria>
