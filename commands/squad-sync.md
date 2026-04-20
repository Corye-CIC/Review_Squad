---
name: squad-sync
description: Sync shared Review Squad state (learnings, patterns, history) with a team git remote
argument-hint: "--init <remote-url> | --push | --pull | --status | --merge"
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

<objective>
Synchronise shared Review Squad state — `learnings.jsonl`, `patterns.md`, `codebase-map.md`, `review-history.md` — with a team-owned git remote so that multiple developers on the same project share a single growing knowledge base.

`--init` wires up the remote once. `--push` and `--pull` move state in and out. `--status` reports drift. `--merge` resolves conflicts after a pull.

`agent-notes/` is per-user and is never synced.
</objective>

<context>
$ARGUMENTS:
- `--init <remote-url>` — initialise sync for this project: validate URL, write config.json, create remote repo if needed, push initial state
- `--push` — copy shared files to the squad-state remote and push
- `--pull` — fetch remote state and merge: union dedup on learnings.jsonl, standard git merge on the rest
- `--status` — show remote, last push/pull timestamps, and ahead/behind state
- `--merge` — scan for conflict markers and print resolution instructions

All output lines are prefixed `[squad-sync]`. Error format: `[squad-sync] ERROR: <what failed> — <why>. <next action>.`
</context>

## Gotchas

1. **Never `git merge` learnings.jsonl.** Union dedup algorithm only. Git merge on JSONL produces malformed JSON on any conflict.
2. **Never `git add .` or `git add -A`.** Stage only named shared files. `agent-notes/` must never be pushed.
3. **`--push` and `--pull` require config.json.** Emit the exact missing field in any config error — not a generic message.
4. **`--init` idempotency.** Same URL: skip silently. Different URL: show old + new, require confirmation (`--yes` or `y/N`).
5. **Fork push safety.** Before any push: compare `config.remote_url` to `git remote get-url squad-state`. Abort if different.
6. **Gitignore gate is step ZERO.** Blocking, not advisory. Verify `.review-squad/` in `.gitignore` before any other `--init` step.
7. **PAT is env-only.** `$GITHUB_TOKEN`. Never prompt. Never store. Never log.
8. **URL validation.** Reject credential-embedded URLs before writing to config or passing to git. Valid schemes: `https`, `git`, `git@`.
9. **API timeout/retry.** GitHub API call: 10s timeout, single retry on 5xx.
10. **Two-stage `--init` error distinction.** If repo creates but push fails: `Repository created but initial push failed. Run /squad-sync --push to retry.` Never say re-run `--init`.
11. **All output prefixed `[squad-sync]`.** No exceptions. Error format: `[squad-sync] ERROR: <what failed> — <why>. <next action>.`
12. **V1 dedup limitation.** Full-line string match only. JSON entries with identical content but different field order are treated as distinct entries.
13. **`team_members[0].username` default.** If config.json absent or `team_members` empty, username = `local` everywhere.

<process>

## Subcommand: --init

```bash
PROJECT=$(basename "$PWD")
CONFIG_DIR=".review-squad/$PROJECT"
CONFIG_FILE="$CONFIG_DIR/config.json"
REMOTE_URL="$1"
```

### Step 1 (BLOCKING): Verify .gitignore

Check that `.review-squad/` is listed in `.gitignore`. If missing, append it.

```bash
if ! grep -qxF '.review-squad/' .gitignore 2>/dev/null; then
  echo '.review-squad/' >> .gitignore
  echo "[squad-sync] Appended .review-squad/ to .gitignore."
fi
echo "[squad-sync] Verifying .gitignore... OK"
```

Do not proceed to any later step until this check passes.

### Step 2: Check GITHUB_TOKEN

```bash
if [ -z "$GITHUB_TOKEN" ]; then
  echo "[squad-sync] ERROR: GITHUB_TOKEN is not set — authentication required. Export your GitHub PAT before running --init."
  exit 1
fi
```

### Step 3: Validate remote URL

Reject any URL containing `user:pass@` (credential-embedded). Reject if scheme is not `https://`, `git://`, or `git@`.

```bash
if echo "$REMOTE_URL" | grep -qP '://[^@]+:[^@]+@'; then
  echo "[squad-sync] ERROR: Credential-embedded URL rejected — remove user:pass from URL. Pass credentials via GITHUB_TOKEN only."
  exit 1
fi
if ! echo "$REMOTE_URL" | grep -qP '^(https://|git://|git@)'; then
  echo "[squad-sync] ERROR: Invalid URL scheme — accepted schemes are https://, git://, git@. Provide a valid remote URL."
  exit 1
fi
```

### Step 4: Check existing config.json

**Case A — config.json exists and remote_url matches the argument:**

```
[squad-sync] Config found. Remote already configured — nothing to do.
```

Exit.

**Case B — config.json exists and remote_url differs:**

```
[squad-sync] Remote URL mismatch in existing config.
  Old: <current remote_url>
  New: <argument>
Proceed? [y/N]
```

If `--yes` flag is present, skip the prompt and proceed. Otherwise wait for input. On `n` or any non-`y` answer, exit without changes.

On confirmation, run: `git remote set-url squad-state <new-url>` and update `remote_url` in config.json.

**Case C — config.json absent:**

Create directory and write config.json with all schema fields:

```bash
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" << EOF
{
  "remote_url": "$REMOTE_URL",
  "strategy": "git-v1",
  "sync_branch": "main",
  "team_members": []
}
EOF
echo "[squad-sync] Config written to $CONFIG_FILE"
```

### Step 5: Create remote repo if needed

If the remote repository does not exist, call the GitHub API to create `squad-state-<project>`.

```bash
echo "[squad-sync] Calling GitHub API to create repository..."
RESPONSE=$(curl --silent --max-time 10 \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d "{\"name\":\"squad-state-$PROJECT\",\"private\":true,\"auto_init\":true}" \
  https://api.github.com/user/repos)

HTTP_STATUS=$(echo "$RESPONSE" | jq -r '.id // empty')
if [ -z "$HTTP_STATUS" ]; then
  # Retry once on any 5xx
  RESPONSE=$(curl --silent --max-time 10 \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"squad-state-$PROJECT\",\"private\":true,\"auto_init\":true}" \
    https://api.github.com/user/repos)
fi

REPO_URL=$(echo "$RESPONSE" | jq -r '.html_url // empty')
if [ -n "$REPO_URL" ]; then
  echo "[squad-sync] Created: $REPO_URL"
fi
```

### Step 6: Register git remote

```bash
if git remote get-url squad-state &>/dev/null; then
  git remote set-url squad-state "$REMOTE_URL"
else
  git remote add squad-state "$REMOTE_URL"
fi
```

### Step 7: Push initial state

```bash
git push squad-state main 2>&1
if [ $? -ne 0 ]; then
  echo "[squad-sync] ERROR: Repository created but initial push failed — push rejected by remote. Run /squad-sync --push to retry."
  exit 1
fi
```

Never instruct the user to re-run `--init` on a push failure.

### Step 8: Done

```
[squad-sync] Done. Squad state initialized.
```

---

## Subcommand: --push

```bash
PROJECT=$(basename "$PWD")
CONFIG_FILE=".review-squad/$PROJECT/config.json"
SHARED_FILES=(learnings.jsonl patterns.md codebase-map.md review-history.md)
```

### Step 1: Read config.json

```bash
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[squad-sync] ERROR: Cannot push — config.json not found. Run /squad-sync --init <remote-url> first."
  exit 1
fi
CONFIG_REMOTE=$(jq -r '.remote_url' "$CONFIG_FILE")
```

### Step 2: Fork push safety check

```bash
ACTUAL_REMOTE=$(git remote get-url squad-state 2>/dev/null)
if [ "$CONFIG_REMOTE" != "$ACTUAL_REMOTE" ]; then
  echo "[squad-sync] ERROR: Remote URL mismatch. Expected $CONFIG_REMOTE, got $ACTUAL_REMOTE. Re-run squad-sync --init to fix."
  exit 1
fi
```

### Step 3: Copy shared files

For each file in `(learnings.jsonl, patterns.md, codebase-map.md, review-history.md)`:

```bash
for f in "${SHARED_FILES[@]}"; do
  SRC=".review-squad/$PROJECT/$f"
  if [ -f "$SRC" ]; then
    cp "$SRC" "<squad-state-working-area>/$f"
    echo "[squad-sync]   $f — copied"
  fi
done
```

### Step 4: Skip agent-notes/

```
[squad-sync]   agent-notes/ — skipped (per-user, not synced)
```

Never stage, copy, or touch any file under `agent-notes/`.

### Step 5: Stage by name only

```bash
for f in "${SHARED_FILES[@]}"; do
  git -C "<squad-state-working-area>" add "$f"
done
```

NEVER run `git add .` or `git add -A`.

### Step 6: Commit

```bash
SYNC_DATE=$(date +%Y-%m-%d)
git -C "<squad-state-working-area>" commit -m "chore(sync): push $PROJECT state $SYNC_DATE"
```

### Step 7: Push

```bash
git -C "<squad-state-working-area>" push squad-state main
```

### Step 8: Summary

```
[squad-sync] Summary: 4 files pushed, agent-notes/ skipped.
```

---

## Subcommand: --pull

```bash
PROJECT=$(basename "$PWD")
CONFIG_FILE=".review-squad/$PROJECT/config.json"
STATE_DIR=".review-squad/$PROJECT"
```

### Step 1: Read config.json

```bash
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[squad-sync] ERROR: Cannot pull — config.json not found. Run /squad-sync --init <remote-url> first."
  exit 1
fi
```

### Step 2: Fetch remote

```bash
git fetch squad-state main
```

### Step 3: Union merge learnings.jsonl

Do NOT run `git merge` on this file. Use the union dedup algorithm only.

```bash
LOCAL_FILE="$STATE_DIR/learnings.jsonl"
REMOTE_FILE=$(git show squad-state/main:learnings.jsonl 2>/dev/null)

LOCAL_COUNT=0
REMOTE_COUNT=0
NEW_COUNT=0

declare -A LOCAL_LINES
while IFS= read -r line; do
  LOCAL_LINES["$line"]=1
  ((LOCAL_COUNT++))
done < "$LOCAL_FILE"

while IFS= read -r line; do
  ((REMOTE_COUNT++))
  if [ -z "${LOCAL_LINES[$line]+_}" ]; then
    echo "$line" >> "$LOCAL_FILE"
    ((NEW_COUNT++))
  fi
done <<< "$REMOTE_FILE"

UNIQUE_COUNT=$((LOCAL_COUNT + NEW_COUNT))
echo "[squad-sync]   learnings.jsonl — union merge: $LOCAL_COUNT local + $REMOTE_COUNT remote → $UNIQUE_COUNT unique entries"
```

Dedup key = full line string. Field order differences create false duplicates — this is a known V1 limitation.

### Step 4: Standard git merge for remaining files

For each of `patterns.md`, `codebase-map.md`, `review-history.md`:

```bash
for f in patterns.md codebase-map.md review-history.md; do
  git merge squad-state/main -- "$STATE_DIR/$f" 2>&1
  if grep -q '<<<<<<<' "$STATE_DIR/$f" 2>/dev/null; then
    echo "[squad-sync]   $f — conflict markers present"
    HAS_CONFLICTS=true
  else
    echo "[squad-sync]   $f — merged clean"
  fi
done
```

### Step 5: Summary

If any conflicts detected:

```
[squad-sync] Summary: N files pulled. M file(s) have conflicts. Run /squad-sync --merge to resolve.
```

If all clean:

```
[squad-sync] Summary: N files pulled. All clean.
```

---

## Subcommand: --status

```bash
PROJECT=$(basename "$PWD")
CONFIG_FILE=".review-squad/$PROJECT/config.json"
```

### Step 1: Read config.json

```bash
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[squad-sync] ERROR: Cannot show status — config.json not found. Run /squad-sync --init <remote-url> first."
  exit 1
fi
```

### Step 2: Print status

```bash
REMOTE_URL=$(jq -r '.remote_url' "$CONFIG_FILE")
LAST_PUSH=$(git log squad-state/main --format="%ar" -1 2>/dev/null || echo "never")

AHEAD=$(git rev-list --count squad-state/main..HEAD 2>/dev/null || echo 0)
BEHIND=$(git rev-list --count HEAD..squad-state/main 2>/dev/null || echo 0)

if [ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ]; then
  SYNC_STATE="[synced]"
elif [ "$AHEAD" -gt 0 ] && [ "$BEHIND" -eq 0 ]; then
  SYNC_STATE="[ahead $AHEAD commits]"
elif [ "$AHEAD" -eq 0 ] && [ "$BEHIND" -gt 0 ]; then
  SYNC_STATE="[behind $BEHIND commits]"
else
  SYNC_STATE="[diverged]"
fi

echo "[squad-sync] Project:    $PROJECT"
echo "[squad-sync] Remote URL: $REMOTE_URL"
echo "[squad-sync] Last push:  $LAST_PUSH"
echo "[squad-sync] Sync state: $SYNC_STATE"
```

Last pull timestamp: derive from the local ref log for `squad-state/main`.

---

## Subcommand: --merge

```bash
PROJECT=$(basename "$PWD")
STATE_DIR=".review-squad/$PROJECT"
SHARED_FILES=(patterns.md codebase-map.md review-history.md)
```

### Step 1: Scan for conflict markers

```bash
CONFLICT_COUNT=0
for f in "${SHARED_FILES[@]}"; do
  FILE="$STATE_DIR/$f"
  if grep -n '<<<<<<<\|=======\|>>>>>>>' "$FILE" 2>/dev/null | head -20; then
    echo "[squad-sync]   $f — conflicts at lines above"
    ((CONFLICT_COUNT++))
  fi
done

if [ "$CONFLICT_COUNT" -eq 0 ]; then
  echo "[squad-sync] No conflict markers found in shared files."
  exit 0
fi
```

### Step 2: Report conflicts by file with line numbers

For each conflicted file, list the line numbers of `<<<<<<<`, `=======`, and `>>>>>>>` markers so the user can navigate directly.

### Step 3: Resolution instructions

```
[squad-sync] To resolve:
[squad-sync]   1. Open the conflicted file(s) listed above.
[squad-sync]   2. Find each block bounded by <<<<<<< ... ======= ... >>>>>>>.
[squad-sync]   3. Keep the correct content, delete the markers and the discarded block.
[squad-sync]   4. Save the file.
[squad-sync] When resolved, run /squad-sync --push to publish.
```

</process>

<success_criteria>
- [ ] `--init` verifies .gitignore as step zero — blocks on failure
- [ ] `--init` rejects credential-embedded URLs and invalid schemes before touching config or git
- [ ] `--init` is idempotent: same URL exits silently; different URL requires confirmation
- [ ] `--init` creates config.json with all four schema fields: remote_url, strategy, sync_branch, team_members
- [ ] `--init` calls GitHub API with 10s timeout and single 5xx retry
- [ ] `--init` distinguishes repo-created-but-push-failed from other errors; never says re-run --init
- [ ] `--push` aborts on remote URL mismatch before any git operation
- [ ] `--push` stages only named files; never git add . or git add -A
- [ ] `--push` skips agent-notes/ and prints the skip line
- [ ] `--push` commit message follows: `chore(sync): push <project> state <YYYY-MM-DD>`
- [ ] `--pull` runs union dedup on learnings.jsonl — never git merge on that file
- [ ] `--pull` reports per-file merge outcome: clean or conflict markers present
- [ ] `--pull` summary directs to --merge when conflicts exist
- [ ] `--status` reports project, remote URL, last push time, and sync state in one of four states
- [ ] `--merge` scans patterns.md, codebase-map.md, review-history.md for conflict markers with line numbers
- [ ] Every output line prefixed [squad-sync]; errors follow ERROR: <what> — <why>. <action>. format
</success_criteria>
