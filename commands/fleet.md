---
name: fleet
description: Orchestrate a parallel worktree fleet — decompose a phased spec into shards, run each in an isolated worktree with its own DB, merge sequentially with validation
argument-hint: "--spec <file.md> [--shards N (default 3, max 5)] [--base-branch main] [--branch-prefix fleet] [--dry-run]"
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
Collapse multi-phase refactors from weeks to hours by running independent phase-shards in parallel worktrees. Each worktree has its own DB (isolated via Postgres DB name per worktree). Standard ports — only one worktree runs dev services at a time; fleet enables parallel AGENT work (editing, unit tests), not parallel SERVICE operation.

**Squad integration:** Workers dispatched to each worktree are squad implement agents (father-christmas-implement, nando-implement, etc.) per the spec's phase-to-domain mapping. After parallel completion, the main worktree sequentially rebase-merges each shard with validation (typecheck/lint/tests) between merges. PM Cory persistent context (.review-squad/<project>/) is shared across worktrees.
</objective>

<context>
$ARGUMENTS:
- `--spec <file.md>` — required. A phased markdown spec with one `## Phase N: <title>` header per independent shard. Each phase must be self-contained (no file dependencies on sibling phases). Example at end of this document.
- `--shards N` — optional, default 3, max 5 (cap due to port-kill coordination)
- `--base-branch <name>` — optional, default: `git remote show origin | grep 'HEAD branch'`
- `--branch-prefix <name>` — optional, default: `fleet` (worktree branches become `fleet-wt1`, `fleet-wt2`, etc.)
- `--dry-run` — plan the decomposition, print shard assignments, do not create worktrees

Safety flags:
- `--skip-db-isolation` — use the main DB for all worktrees (NOT recommended — kept for SQLite projects or single-DB setups)
- `--keep-on-failure` — leave worktrees intact if merge/validation fails (for debugging)
</context>

<process>

## Step 0: Pre-flight

### 0a. Tool availability
```bash
command -v git >/dev/null || { echo "git required"; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm required"; exit 1; }
command -v lsof >/dev/null || { echo "lsof required for port checks"; exit 1; }
command -v psql >/dev/null || { echo "psql required (install postgres client)"; exit 1; }
```

### 0b. Repo state
```bash
pwd
git rev-parse --show-toplevel
git branch --show-current
git status --porcelain
```
If the working tree is dirty, STOP: `"Uncommitted changes in main worktree. Commit or stash before running /fleet."` Do not silently stash — user needs to decide.

### 0c. Base branch detection
```bash
BASE_BRANCH=${BASE_BRANCH:-$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}' || echo main)}
```

### 0d. DB config detection
Read `packages/database/drizzle.config.ts` or the closest `.env` / `.env.example` to find the DB name and connection URL. Parse:
- DB name (default for GSD projects: `gsd`)
- User (default: `postgres`)
- Host / port (default: `localhost:5432`)
- Password (from env or .env file — do not print)

If drizzle.config.ts is missing and no `.env` with `DATABASE_URL`, ask the user before proceeding:
```
Cannot auto-detect DB config. Provide:
1. DB name base (e.g., "gsd")
2. Connection URL template
```

## Step 1: Parse spec and decompose

### 1a. Read spec
```bash
SPEC_FILE="<--spec argument>"
[ ! -f "$SPEC_FILE" ] && { echo "Spec file not found: $SPEC_FILE"; exit 1; }
```

### 1b. Extract phases
Find all `## Phase N: <title>` headers. For each phase, capture:
- Phase number (N)
- Title
- Body (until next `## Phase` or EOF)
- Any `**Target agent:**` or `**Files:**` metadata lines inside the phase body

If the spec declares more phases than `--shards`, merge adjacent phases until count matches. If fewer, shards = phase count.

### 1c. Validate independence
For each pair of phases, check that file paths mentioned in `**Files:**` metadata do not overlap. If they do, STOP:
```
Phase N and Phase M both target <overlapping-file>. Phases must be independent for parallel execution.
Either rewrite the spec to consolidate overlapping work into one phase, or run /fleet on a subset of phases.
```

### 1d. Assign target agents per phase
For each phase, determine the target squad implement agent from the phase metadata OR by content heuristic:
- DB / schema / migrations → `father-christmas-implement` (default)
- Auth / security / validation → `jared-implement`
- Frontend / UX / components → `stevey-boy-choi-implement`
- Cross-cutting architecture → `nando-implement`
- Backend general → `father-christmas-implement`

If `--dry-run`: print the decomposition table and exit:
```
| Shard | Phase | Title | Target agent | Files |
|-------|-------|-------|--------------|-------|
| 1     | 2     | ...   | ...          | ...   |
```

## Step 2: Port pre-flight (kill-before-start)

### 2a. Identify required ports
Default standard ports for this stack:
```bash
PORTS=(5173 5174 3000 3001 3002 3003 3004 3005 3006 5432)
```
Adjust if the project's `docker-compose.yml` or `package.json` uses different ports.

### 2b. Check each port
```bash
for port in "${PORTS[@]}"; do
  PID=$(lsof -i :$port -t 2>/dev/null | head -1)
  if [ -n "$PID" ]; then
    CWD=$(readlink /proc/$PID/cwd 2>/dev/null || echo "unknown")
    CMD=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
    echo "Port $port occupied by PID $PID ($CMD) in $CWD"

    # If the process's cwd is inside a fleet worktree from a prior run, auto-kill
    if [[ "$CWD" == *.worktrees/${BRANCH_PREFIX}-wt* ]]; then
      echo "  → auto-killing (prior fleet leftover)"
      kill $PID
      sleep 2
      kill -9 $PID 2>/dev/null || true
    else
      # Otherwise prompt user via AskUserQuestion
      # Options: "kill" / "skip port" / "cancel fleet"
      echo "  → user-gated; prompting"
    fi
  fi
done
```

### 2c. Note for user
Since ports are not offset per worktree, only ONE worktree can run dev services at a time. The fleet's parallelism is in agent work (file edits, unit tests that don't bind ports), not service operation. If a worker needs a running service for its phase work, it must explicitly request the service baton — surface this as a warning in Step 4's per-worker prompt.

## Step 3: Create worktree fleet

### 3a. Directory setup
```bash
WORKTREES_DIR="$(git rev-parse --show-toplevel)/.worktrees"
mkdir -p "$WORKTREES_DIR"
```

### 3b. For each shard (1..N)
```bash
for i in $(seq 1 $SHARDS); do
  WT_NAME="${BRANCH_PREFIX}-wt${i}"
  WT_PATH="${WORKTREES_DIR}/${WT_NAME}"
  WT_BRANCH="${BRANCH_PREFIX}/wt${i}"

  # Create worktree with a new branch from base
  git worktree add "$WT_PATH" -b "$WT_BRANCH" "$BASE_BRANCH"

  # Copy .env with isolated DB name (unless --skip-db-isolation)
  if [ ! "$SKIP_DB_ISOLATION" = "true" ]; then
    DB_NAME="${DB_NAME_BASE}_wt${i}"

    # Create isolated Postgres DB
    psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME};" 2>&1 \
      | grep -v "already exists" \
      || echo "DB ${DB_NAME} created or already existed"

    # Write worktree's .env with overridden DB name
    cp .env "$WT_PATH/.env"
    sed -i "s|/${DB_NAME_BASE}|/${DB_NAME}|g" "$WT_PATH/.env"

    # Run migrations in the worktree
    (cd "$WT_PATH" && pnpm install --frozen-lockfile && pnpm -F database migrate) \
      || { echo "Migration failed in wt${i}"; exit 1; }
  fi

  # Link .review-squad/ so PM Cory persistent context is shared
  ln -sfn "$(git rev-parse --show-toplevel)/.review-squad" "$WT_PATH/.review-squad"

  # Link shared node_modules if the setup allows (optional optimization)
  # Skipped by default — pnpm handles this via the monorepo lockfile

  echo "Worktree $i: $WT_PATH (branch $WT_BRANCH, DB $DB_NAME)"
done
```

## Step 4: Dispatch parallel agents

### 4a. Per-phase worker prompt
For each shard in parallel, dispatch via `Agent` with `subagent_type=<target-agent>` determined in Step 1d. Each worker prompt:

```
You are the implement-mode agent assigned to fleet shard {i} of {N}.

Working directory: {WT_PATH}
Branch: {WT_BRANCH}
Base branch: {BASE_BRANCH}
Isolated DB: {DB_NAME}

Your phase:
<phase N body verbatim from the spec, including Title, Files, and acceptance criteria>

Hard constraints:
1. cd to {WT_PATH} before any file operation. Do NOT edit files outside this worktree.
2. Do NOT run `pnpm dev` or any service-starting command — the fleet uses standard ports and only one worktree may run services at a time. Other shards are working in parallel.
3. You MAY run: unit tests that don't bind ports, typecheck, lint, file edits, migrations against the isolated DB, `git add`, `git commit`.
4. You MAY NOT run: `git push`, `git merge`, `git rebase`. The main worktree handles merging.
5. If you hit an unresolvable blocker (e.g., need a running service, phase scope ambiguous), commit any partial work with a WIP: prefix and return "BLOCKED: <one-line reason>".
6. On successful phase completion, ensure:
   - All target files exist and compile (`pnpm typecheck`)
   - All changes are committed to {WT_BRANCH}
   - Return "DONE: <one-line summary>" along with the list of commits made
7. Do NOT touch .review-squad/ contents — it is shared via symlink.

PM Cory persistent context: .review-squad/<project>/agent-notes/
```

### 4b. Dispatch
Send all N agents in a single message via multiple Agent tool calls. Collect results as they return.

### 4c. Handle partial failure
If one or more workers return `BLOCKED:`:
- The other shards may have completed successfully
- Proceed to Step 5 with only DONE shards
- Surface BLOCKED shards at end for user to resume manually

## Step 5: Sequential rebase-merge into main

Return to the main worktree:
```bash
cd "$(git rev-parse --show-toplevel)"
git checkout "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH"
```

### 5a. For each DONE shard (in declared order)
```bash
for i in $(seq 1 $SHARDS); do
  [ "${STATUS[$i]}" != "DONE" ] && { echo "Skipping wt${i}: ${STATUS[$i]}"; continue; }

  WT_BRANCH="${BRANCH_PREFIX}/wt${i}"

  # Attempt merge (not rebase — preserve the shard's commits)
  git merge --no-ff --no-edit "$WT_BRANCH" 2>&1 | tee /tmp/fleet-merge-wt${i}.log
  MERGE_EXIT=${PIPESTATUS[0]}

  if [ $MERGE_EXIT -ne 0 ]; then
    # Check conflict type
    CONFLICTS=$(git diff --name-only --diff-filter=U)
    TRIVIAL=true
    for f in $CONFLICTS; do
      # Trivial if conflict is only in import ordering or whitespace
      git diff "$f" | grep -qE '^[<=>]{7}' && TRIVIAL=false
    done

    if [ "$TRIVIAL" = true ]; then
      # Auto-resolve (imports, formatting)
      pnpm prettier --write $CONFLICTS 2>/dev/null || true
      git add $CONFLICTS
      git merge --continue --no-edit
      echo "wt${i}: trivial conflicts auto-resolved"
    else
      echo "wt${i}: non-trivial conflicts in: $CONFLICTS"
      git merge --abort
      break  # Stop the merge chain; surface to user
    fi
  fi

  # Validate after merge
  timeout 300 pnpm typecheck 2>&1 | tail -20
  TC_EXIT=${PIPESTATUS[0]}
  timeout 120 pnpm lint 2>&1 | tail -20
  LINT_EXIT=${PIPESTATUS[0]}

  if [ $TC_EXIT -ne 0 ] || [ $LINT_EXIT -ne 0 ]; then
    echo "wt${i}: validation failed after merge. Reverting."
    git reset --hard ORIG_HEAD
    break
  fi

  echo "wt${i}: merged and validated"
done
```

### 5b. Stop-on-failure behavior
If any merge fails validation, the chain stops. The main branch is left at the last successful merge state. Remaining shards stay in their worktrees for user inspection.

## Step 6: Teardown

### 6a. Conditional teardown
- If `--keep-on-failure` flag was set AND any shard failed: leave everything in place, print the shard state summary
- Otherwise: teardown successful shards

### 6b. For each DONE + merged shard
```bash
for i in $(seq 1 $SHARDS); do
  [ "${STATUS[$i]}" != "DONE+MERGED" ] && continue

  WT_PATH="${WORKTREES_DIR}/${BRANCH_PREFIX}-wt${i}"
  WT_BRANCH="${BRANCH_PREFIX}/wt${i}"
  DB_NAME="${DB_NAME_BASE}_wt${i}"

  # Remove worktree
  git worktree remove --force "$WT_PATH" 2>&1 || true

  # Delete the shard branch (now merged into base)
  git branch -D "$WT_BRANCH" 2>&1 || true

  # Drop isolated DB
  if [ ! "$SKIP_DB_ISOLATION" = "true" ]; then
    psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>&1 || true
  fi

  echo "Torn down wt${i}"
done
```

## Step 7: Report

Print a summary:
```
## Fleet run complete

Spec: {SPEC_FILE}
Base: {BASE_BRANCH}
Shards: {N}

| Shard | Phase | Agent | Status | Commits |
|-------|-------|-------|--------|---------|
| 1 | 2 | fc | MERGED | 3 |
| 2 | 3 | stevey | MERGED | 2 |
| 3 | 4 | fc | BLOCKED: needs running service | 1 (WIP) |

Next actions:
- Shard 3 needs manual resume: cd .worktrees/fleet-wt3, start service, continue phase.
- Main branch now ahead by {X} commits. Run /review before /ship.
```

If any shards blocked or failed, leave the failing worktrees in place and the user's .env untouched.

</process>

<success_criteria>
- [ ] Pre-flight validated (tools, repo clean, base branch detected)
- [ ] Spec parsed into N phases, independence verified, target agents assigned
- [ ] Port pre-flight completed (fleet leftovers auto-killed, other processes user-gated)
- [ ] N worktrees created with isolated DBs (`gsd_wt1` pattern) and linked `.review-squad/`
- [ ] Agents dispatched in parallel, one per worktree, scoped to one phase
- [ ] Sequential merge executed with per-shard typecheck+lint validation
- [ ] Non-trivial conflicts abort the chain, trivial conflicts auto-resolve via prettier
- [ ] Successful shards torn down (worktree + branch + DB); failed shards kept for inspection
- [ ] Final report covers merged/blocked/failed per shard with clear next actions
</success_criteria>

<example_spec>
## Example spec — save as `refactor.fleet.md`

```markdown
# Refactor: queue management cleanup

## Phase 1: Extract queue selector hook
**Target agent:** father-christmas-implement
**Files:** apps/backoffice/src/hooks/useQueueSelector.ts, apps/backoffice/src/hooks/useQueueSelector.test.ts
**Acceptance:** Hook exists, unit tests pass, no other files changed.

## Phase 2: Migrate queue dropdown to new hook
**Target agent:** stevey-boy-choi-implement
**Files:** apps/backoffice/src/components/QueueDropdown.tsx
**Acceptance:** Component uses the new hook, visual output unchanged, tsc clean.

## Phase 3: Add queue persistence to user settings
**Target agent:** father-christmas-implement
**Files:** packages/database/src/schema/userSettings.ts, packages/database/migrations/*
**Acceptance:** Migration creates column, schema type updated, unit test confirms default.
```
</example_spec>
