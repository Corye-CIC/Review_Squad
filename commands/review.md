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
<objective>
Run the 6-agent Review Squad on changed files. Works in any project — GSD or not.

The squad:
1. **Father Christmas** — Code quality + novel approaches
2. **Jared** — Security, efficiency, systems reuse
3. **Stevey Boy Choi** — UX/UI, frontend performance, accessibility (frontend only)
4. **PM Cory** — PM, creative challenger, persistent memory agent
5. **Nando** — Lead reviewer, synthesizes all outputs, delivers technical verdict
6. **Emily** — Final reviewer, verifies plan adherence, accessibility compliance, and UX intent
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
- **Backend/general files** — reviewed by FC, Jared, PM Cory
- **Frontend files** — also reviewed by Stevey Boy Choi
  Frontend detection: files in `frontend/`, `src/components/`, `src/pages/`, `public/`, or with extensions `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`

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
- `father-christmas` — with all changed files
- `jared` — with all changed files
- `pm-cory` — with all changed files + SQUAD_DIR path for persistent memory

**If frontend files present:**
- `stevey-boy-choi` — with frontend files (+ any shared utilities they import)

Each agent prompt must include:
- The complete list of files to review
- Working directory path
- Brief context on what the changes are for (from git log or user description)
- Instruction to Read every file before reviewing

## Step 5: Spawn Nando

After all parallel agents complete, spawn `nando` with all their outputs concatenated.

Nando receives:
- All agent outputs
- The file list
- Instructions to read any files flagged by multiple reviewers

## Step 6: Spawn Emily (Final Review)

After Nando completes, spawn `emily` in **review mode** with:
- Nando's consolidated verdict
- All agent review outputs
- The plan from `.review-squad/<project-name>/current-plan.md` (if it exists)
- The discussion from `.review-squad/<project-name>/current-discussion.md` (if it exists)
- The research from `.review-squad/<project-name>/current-research.md` (if it exists)

Emily's prompt:
```
You are performing your final review after Nando's technical verdict.

=== NANDO — Consolidated Review ===
{nando_output}

=== AGENT REVIEWS (for reference) ===
FC: {bbc_output}
Jared: {jared_output}
Stevey: {stevey_output (if applicable)}
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

Perform your final review. Check plan adherence, research alignment,
requirements coverage, accessibility compliance, and UX intent.
Deliver your CONFIRM or CHALLENGE verdict.

If no plan/discussion/research exists, note this gap and provide a
lighter-touch review focused on accessibility and UX intent.
```

Emily checks plan adherence, research alignment, requirements coverage, accessibility compliance, and UX intent. She delivers a CONFIRM or CHALLENGE verdict.

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
- [ ] FC, Jared, PM Cory spawned in parallel (+ Stevey if frontend)
- [ ] All agents completed reviews
- [ ] Nando synthesized technical verdict
- [ ] Emily verified plan adherence, accessibility, and UX intent
- [ ] PM Cory persisted learnings to .review-squad/
- [ ] Combined verdict presented with clear next steps
</success_criteria>
