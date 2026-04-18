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
- `--skip-preflight`: Skip the Step 0 gate (use only when you have a justification)
- `--pr <N>`: Explicitly bind this review to PR #N (enables branch-assertion check)
- `--mode <skip|thin|full|deep>`: Override the Step 0.5 classifier
- `--incremental`: When the argument is a commit range (e.g., `HEAD~3..HEAD`), review each commit separately, carrying findings from earlier commits forward as context (see Step 1.5)
</context>

<process>

## Step 0: Pre-Flight Gate

Before spawning any reviewer agents, verify session context and validate the working tree. The review squad is expensive — do not invoke it on code that has not passed basic validation.

### 0a. Session context verification
Run in a single parallel Bash block:
```bash
pwd
git branch --show-current
git status -sb
gh pr view --json number,title,headRefName 2>/dev/null || true
```

Output a one-line confirmation:
`"Reviewing <branch> in <cwd>[ · PR #<N>: <title>]"`

### 0b. Branch assertion (blocking)
If $ARGUMENTS contains `--pr <N>` OR `gh pr view` returned a `headRefName`:
- Compare `git branch --show-current` against the expected PR branch
- If mismatch, STOP with:
  `"Branch mismatch: currently on '<current>', PR #<N> expects '<expected>'. Switch branches or clarify intent before continuing."`
- Do not spawn reviewers.

### 0c. Validation gate (blocking unless --skip-preflight)
If $ARGUMENTS contains `--skip-preflight`, skip this step but note in the final verdict that preflight was bypassed.

Otherwise, if `package.json` exists in the working directory or any parent up to the repo root:
- If it declares a `typecheck` script: run `pnpm typecheck 2>&1 | tail -40`
- If it declares a `lint` script: run `pnpm lint 2>&1 | tail -40`

If either returns a non-zero exit code, STOP with:
```
Pre-flight failed: [typecheck|lint] returned errors.

First 10 lines of output:
<first 10 lines>

The review squad only reviews code that compiles and lints clean. Fix the errors and re-run /review.
To override, re-run with --skip-preflight.
```
Do not spawn reviewers.

### 0d. Test advisory (non-blocking)
If `package.json` declares a `test` script AND any changed file is a source file likely covered by tests, emit a one-line advisory:
`"Tests not run during pre-flight — run 'pnpm test' after review if changes affect test coverage."`
Continue to Step 0.5.

## Step 0.5: Diff classifier (routing)

Classify the diff so the squad can skip trivial changes, run thin on small ones, and escalate on high-risk surfaces. Output a single `ROUTING_MODE` that the rest of the command consults.

### 0.5a. Collect routing signals

```bash
# Use the same file set that Step 1 will resolve. For classification only (not review yet).
git diff --name-only HEAD 2>/dev/null > /tmp/_review_files_$$
git diff --name-only --cached 2>/dev/null >> /tmp/_review_files_$$
git ls-files --others --exclude-standard 2>/dev/null >> /tmp/_review_files_$$
sort -u /tmp/_review_files_$$ > /tmp/_review_files_unique_$$
FILES=$(cat /tmp/_review_files_unique_$$)
FILE_COUNT=$(echo "$FILES" | grep -c . || echo 0)
LINES_CHANGED=$(git diff --numstat HEAD 2>/dev/null | awk '{s+=$1+$2} END {print s+0}')
```

### 0.5b. Classify

Apply these rules in order. First match wins. Routing output is one of: `skip-mode` | `thin-mode` | `full-mode` | `deep-mode`.

1. **deep-mode** — if ANY of:
   - File path matches `migrations/`, `migrate/`, `schema/`, or filename ends in `.sql`
   - File path matches `auth*`, `passport*`, `session*`, `oauth*`, `login*`, `token*` (code files)
   - File path matches `crypto*`, `jwt*`, `password*`, `permission*`, `rbac*`
   - File is a CSP header, CORS config, or cookie config
   - Commit message body (last 5 commits) contains "security", "cve", "vulnerability", "rbac"

2. **skip-mode** — if ALL of:
   - Every changed file has extension `.md`, `.txt`, or is in `docs/`, `README*`
   - No file under `src/`, `lib/`, `apps/`, `packages/*/src/`
   - `LINES_CHANGED` ≤ 200

3. **thin-mode** — if ANY of:
   - Every changed file matches `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx`, `tests/`, `__tests__/`, `e2e/`
   - Every changed file is a lockfile or package.json version bump (diff contains only `"version":` changes in package.json; lockfile auto-regen)
   - `FILE_COUNT` ≤ 2 AND `LINES_CHANGED` ≤ 50 AND no frontend files (no `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`)

4. **full-mode** — default

### 0.5c. Apply routing

```
case "$ROUTING_MODE" in
  skip-mode)
    Output: "Diff classified as docs-only (<N> files, <M> lines). Skipping squad — no code changes detected."
    Exit cleanly with no squad spawn.
    ;;
  thin-mode)
    Output: "Diff classified as <test-only|lockfile-bump|trivial> — running thin mode (FC + Jared only)."
    Continue. Step 4 will use thin roster.
    ;;
  full-mode)
    Output: "Diff classified as full review — running standard squad."
    Continue.
    ;;
  deep-mode)
    Output: "Diff classified as HIGH-RISK (<matched rule>) — running deep mode (full squad + Jared audit pass)."
    Continue. Step 4 will add Jared audit pass.
    ;;
esac
```

Export `ROUTING_MODE` as a shell variable for downstream steps.

### 0.5d. Classifier override

If `$ARGUMENTS` contains `--mode <skip|thin|full|deep>`, override the classifier and use the specified mode. Skip steps 0.5a and 0.5b. This gives the user escape hatches for when the heuristic is wrong.

### 0.5e. CI delegation (Phase 2 hook)

When this command runs in Claude Code CI mode (env `CLAUDE_CODE_HEADLESS=1`), the classifier logic above can be delegated to a cheaper model. The CI wrapper script (Phase 2) is expected to invoke:

```bash
claude -p "$(cat <<EOF
Classify this diff into skip-mode | thin-mode | full-mode | deep-mode using the rules in Step 0.5b of /review. Output only the mode label on a single line, nothing else.

FILES:
$(cat /tmp/_review_files_unique_$$)

DIFF STATS:
$(git diff --stat HEAD 2>/dev/null | tail -20)
EOF
)" --model claude-haiku-4-5 --max-tokens 10
```

Interactive runs use orchestrator judgment (cheaper than a separate Haiku call for a user already in session).

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

## Step 1.5: Incremental mode (optional)

If `$ARGUMENTS` contains `--incremental` AND the argument also contains a commit range (`<ref>..<ref>` or `HEAD~N..HEAD`):

### 1.5a. Enumerate commits

```bash
RANGE=$(echo "$ARGUMENTS" | grep -oE '[A-Za-z0-9_/^~.@{}-]+\.\.[A-Za-z0-9_/^~.@{}-]+|HEAD~[0-9]+\.\.HEAD' | head -1)
COMMITS=$(git rev-list --reverse "$RANGE")
COMMIT_COUNT=$(echo "$COMMITS" | grep -c .)
```

If `COMMIT_COUNT` > 10, warn the user: "Incremental review of >10 commits is expensive. Consider reviewing the aggregate diff instead." Ask `AskUserQuestion`: proceed / fall back to aggregate / abort.

### 1.5b. Loop — per-commit review

For each commit SHA in order:

1. Reset the file set to that commit's diff: `git diff --name-only $SHA^..$SHA`
2. Re-run Step 0.5 classifier against THIS commit's files (per-commit routing can differ from the range-level routing)
3. Re-run Step 3.5 context pre-loading with only this commit's files
4. Apply Step 3.6 chunking (usually skipped — single commits rarely exceed 30 files)
5. Spawn Step 4 reviewers. Each reviewer's prompt includes a new `<prior-findings>` block summarizing findings from earlier commits in this incremental run:

```
<prior-findings>
Earlier commits in this incremental review:

Commit <short-sha-1> (<subject line>):
  - FC: <top 3 findings, truncated>
  - Jared: <...>
  - Nando verdict: <verdict>

Commit <short-sha-2> (<subject line>):
  - <...>

When reviewing the current commit, look for:
  1. Regressions — does the current commit undo a fix from an earlier commit in this range?
  2. Repeated patterns — does the current commit make the same class of mistake flagged earlier?
  3. Cross-commit incoherence — does the current commit conflict with architectural decisions implied by earlier commits?
</prior-findings>
```

6. Run Step 5 (Nando) for this commit with the prior-findings context.
7. Record Nando's verdict keyed by SHA.
8. Append per-commit results to an in-memory log for use in the next iteration.

### 1.5c. Aggregate verdict

After all commits reviewed:

```
## Incremental review — <N> commits in <range>

| SHA | Subject | Verdict | Blocking findings |
|---|---|---|---|
| abc123 | feat: add auth middleware | APPROVE | 0 |
| def456 | refactor: rename session token | REVISE | 2 |
| ghi789 | fix: handle null session | APPROVE | 0 |

Aggregate verdict: **REVISE** (weakest verdict wins, per-commit blockers listed inline)

Cross-commit signals:
- 2 regressions detected: def456 renamed session token without updating consumer in ghi789-adjacent file
- 1 repeated pattern: FC flagged same null-safety gap in abc123 and ghi789
```

Skip Step 6 (Emily final review) per-commit. Run Emily ONCE at the end against the aggregate file set — Emily's validation is about the end state, not each intermediate commit.

Return from Step 1.5 after producing the aggregate report. Do not fall through to Step 2.

If NOT in incremental mode, continue to Step 2.

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

If each path exists, read the file and store its contents as `plan_content`, `discussion_content`, `research_content` respectively. Pass the file contents (not the paths) to Emily's prompt.

## Step 3.5: Context Pre-Loading

Apply the security denylist before reading any file: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

**Discover:** All changed files identified in Step 1 (already resolved — no additional discovery needed).

**Read:** Read each changed file's contents into orchestrator context (one pass, after denylist filter). If the changed file count exceeds 20, log an advisory: "Large diff detected ({n} files) — pre-loading all files; monitor for context window pressure."

**Bundle (shared block):** All changed files go into `<shared-files>` — every review agent needs the same set. `<agent-files>` is empty for all review agents.

```xml
<injected-context>
<context-meta command="/review" agent="{agent-name}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your review, note the gap in your output — do not self-expand scope.

<shared-files>
<file path="{changed-file-path}">
{file contents verbatim}
</file>
</shared-files>

<agent-files></agent-files>

</injected-context>
```

This same `<shared-files>` block is distributed to all agents in Step 4, Step 5 (Nando), and Step 6 (Emily).

## Step 3.6: Chunking (for diffs > 30 files)

Large diffs exhaust orchestrator context and produce shallow reviews. At `FILE_COUNT > 30`, split the review into chunks, run each chunk independently, and let Nando synthesize across chunks.

### 3.6a. Chunking decision

`FILE_COUNT` from Step 0.5a reflects the working tree. When `$ARGUMENTS` supplies explicit files or a git ref, Step 1 may have resolved a different file set. Recompute from Step 1's resolved list before checking the threshold:

```bash
# Recompute from the actual file set Step 1 resolved (not the Step 0.5 working-tree snapshot).
FILE_COUNT=$(echo "$RESOLVED_FILES" | grep -c . || echo 0)

if [ "$FILE_COUNT" -le 30 ]; then
  CHUNKED=false
  CHUNKS="all"   # single chunk = all files
else
  CHUNKED=true
fi
```

If `CHUNKED=false`, proceed to Step 4 with a single chunk — the existing `<shared-files>` block is that chunk.

### 3.6b. Chunking strategy

If `CHUNKED=true`:

1. **Monorepo detection.** Check for any of these at repo root: `pnpm-workspace.yaml`, `lerna.json`, `turbo.json`, `nx.json`, `rush.json`. If found, parse workspace globs and group changed files by the workspace package they belong to. Each package = one chunk.

2. **Non-monorepo fallback.** Group changed files by first-level path segment (e.g., `src/`, `apps/web/`, `apps/api/`, `lib/`, `migrations/`, `docs/`).

3. **Rebalance.** If any single chunk has >30 files, split that chunk by second-level subdirectory. Repeat until no chunk exceeds 30.

4. **Cap.** Maximum 8 chunks per review. If the natural grouping produces >8, merge the smallest adjacent chunks (by file count) until at 8. If files of very different domains merge (e.g., `docs/` + `migrations/` because both are small), note in the output: "Chunk N contains mixed domains due to 8-chunk cap — accept some loss of per-domain focus."

### 3.6c. Per-chunk context block

For each chunk, assemble its own `<shared-files>` block containing only that chunk's files:

```xml
<injected-context>
<context-meta command="/review" agent="{agent-name}" chunk="{chunk-label}" files="{n}" chunked_total="{TOTAL_CHUNKS}" />
<shared-files>
  <file path="..."> ... </file>
  ...
</shared-files>
<agent-files></agent-files>
</injected-context>
```

`chunk-label` format: `<strategy>-<name>`. Examples: `workspace-api`, `workspace-web`, `path-src`, `path-migrations`.

### 3.6d. Output chunking summary (pre-Step-4)

Emit one line per chunk:

```
Chunks: 5
  - workspace-api: 18 files (backend, spawns Jared + FC + PM Cory)
  - workspace-web: 12 files (frontend, spawns Jared + FC + Stevey frontend + PM Cory)
  - workspace-shared: 6 files (shared lib, spawns FC + Jared)
  - path-migrations: 2 files (migrations, spawns deep-mode roster)
  - path-docs: 3 files (docs-only, would be skip but bundled here due to chunking)
```

Proceed to Step 4.

## Step 4: Spawn reviewers in parallel

Roster selection is driven by `ROUTING_MODE` from Step 0.5:

- **thin-mode**: spawn `jared-review` + `father-christmas-review` only. Skip Stevey and PM Cory. Go to Nando.
- **full-mode**: spawn all four reviewers in parallel (FC, Jared, Stevey, PM Cory).
- **deep-mode**: spawn all four reviewers PLUS `jared-audit` for a dedicated security sweep on the high-risk surfaces identified by the classifier. Jared's audit output is appended to Nando's input alongside the four review outputs.

Spawned agents receive:
- `father-christmas-review` — with all changed files
- `jared-review` — with all changed files
- `stevey-boy-choi-review` — with all changed files (connectivity hat always on; if frontend files present, note which files activate his frontend hat too)
- `pm-cory-review` — with all changed files + SQUAD_DIR path for persistent memory
- `jared-audit` (deep-mode only) — same file list but with an explicit mandate: "This review was classified as high-risk. Perform a full security audit pass against Tier 1 + Tier 2 checks from `agents/_shared/jared-security-intelligence.md`."

### Step 4 behavior under chunking

If `CHUNKED=false`: spawn the roster once on the full file set (existing behavior).

If `CHUNKED=true`:
- Iterate chunks SEQUENTIALLY (not all chunks in parallel — 4 × 8 = 32 concurrent agents is too many).
- Within each chunk, spawn the chunk's roster in parallel.
- Roster-per-chunk is determined by the chunk's file set passed through the Step 0.5 classifier rules (e.g., a migrations chunk runs deep-mode even if the overall diff was full-mode).
- Record each chunk's (FC / Jared / Stevey / PM Cory) output keyed by `chunk-label` so Nando can iterate them.
- After all chunks complete, proceed to Step 5.

Each agent prompt must include:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.` at the top of the task description
- The complete list of files to review
- Working directory path
- Brief context on what the changes are for (from git log or user description)
- The assembled `<injected-context>` block from Step 3.5 (with `agent="{agent-name}"` filled in for each agent)
- A `<file-scope>` block hard-constraining the agent to the changed files:

```
<file-scope>
Review ONLY these files:
- [changed file 1]
- [changed file 2]
- ...
Files listed here that also appear in <injected-context> are pre-loaded — do not re-read them. Files listed here NOT in <injected-context> are permitted reads if you have genuine need.
</file-scope>
```

## Step 5: Spawn Nando

After all parallel agents complete, spawn `nando-review` with all their outputs concatenated.

Nando receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.` at the top of the task description
- The assembled `<injected-context>` block from Step 3.5 (with `agent="nando-review"`)
- All agent outputs
- The file list
- Working directory: {cwd}
- Instructions to read any files flagged by multiple reviewers that are NOT already in `<injected-context>`

### Nando under chunking

If `CHUNKED=true`, Nando receives outputs grouped by chunk, with explicit cross-chunk synthesis instructions:

```
=== CHUNKED REVIEW ===
This review covered {FILE_COUNT} files split into {TOTAL_CHUNKS} chunks. For each chunk you have all reviewer outputs keyed by chunk label.

Your synthesis task has two passes:

Pass 1 — Per-chunk verdict. For each chunk, produce a sub-verdict (APPROVE / REVISE / BLOCK) using the usual process. Present these as "Chunk <label>: <verdict> — <1-line summary>".

Pass 2 — Cross-chunk pattern detection. Look for:
  - Findings that repeat across 3+ chunks (systemic issue, promote to BLOCKER regardless of per-chunk severity)
  - Findings in one chunk whose root cause is in another (e.g., API chunk flags a missing field; web chunk shows the consumer assuming it exists)
  - Architectural drift — chunks deviating from each other on naming, error handling, or data-shape conventions

Output your FINAL verdict based on the cross-chunk view. A single chunk with a BLOCKER blocks the whole review. A systemic pattern across chunks is more severe than an isolated one.

=== CHUNK OUTPUTS ===
<one block per chunk, each containing the chunk's FC/Jared/Stevey/PM Cory outputs>
```

If `CHUNKED=false`, Nando's input is the existing non-chunked format.

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
Context is pre-loaded in <injected-context> below. Do not re-read those files.

{injected-context block from Step 3.5 with agent="emily-review"}

You are performing your final review after Nando's technical verdict.
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

Changed files: {file_list}
Working directory: {cwd}
PM Cory persistent context: {SQUAD_DIR}/
Note: read {SQUAD_DIR}/agent-notes/ to surface prior learnings from PM Cory's persistent memory.

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

**Auto-handoff on REVISE or BLOCK:**
After presenting a REVISE or BLOCK verdict, if ANY of the following are true, invoke `/handoff "<branch-name> — review REVISE"` before returning control to the user:
- Session has already burned significant context (subjective self-assessment — if in doubt, write the handoff)
- Nando's verdict includes 3 or more BLOCKER or MUST-FIX items
- Emily's verdict is CHALLENGE in addition to Nando REVISE
- Any blocker references a file not yet opened in this session (high cost to resume without a handoff)

This prevents the recurring pattern where context exhaustion hits between a REVISE verdict and the next session, forcing the user to reconstruct context from scratch. The squad itself captures the blocker list while it is still fresh.

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
