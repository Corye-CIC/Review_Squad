---
name: update
description: Pull the latest Review Squad from the source repo and sync agents, commands, templates, and hooks to ~/.claude/
argument-hint: ""
allowed-tools:
  - Bash
  - AskUserQuestion
---
<objective>
Pull the latest Review Squad release from the local clone of the repo and sync updated files into ~/.claude/. Shows exactly which files changed. Never touches GSD agents or any non-Review-Squad files.
</objective>

<process>

## Step 1 — Resolve Repo Path

Read the saved config:
```bash
cat ~/.claude/review-squad-repo 2>/dev/null
```

If the file exists and contains a non-empty path, use it as `REPO`. Skip to Step 2.

If missing or empty, attempt auto-detection:
```bash
for dir in ~/Claude/SubAgents ~/review-squad ~/Projects/review-squad ~/code/review-squad ~/dev/review-squad; do
  [ -f "${dir}/agents/father-christmas-implement.md" ] && echo "$dir"
done
```

- **Exactly one result:** use it as `REPO`, save it: `printf '%s\n' "$REPO" > ~/.claude/review-squad-repo`. Inform the user: `Auto-detected repo at {REPO} — saved to ~/.claude/review-squad-repo`
- **Zero or multiple results:** use `AskUserQuestion` to ask: `"Enter the absolute path to your Review Squad repo clone (e.g. /home/you/Claude/SubAgents):"`. Validate that the entered path contains `agents/father-christmas-implement.md`. If invalid, stop: `"Path not recognised as a Review Squad repo. Check that agents/father-christmas-implement.md exists there."` If valid, save to `~/.claude/review-squad-repo` and continue.

Verify the path is a git repo:
```bash
git -C "$REPO" rev-parse --git-dir > /dev/null 2>&1
```
If non-zero, stop: `"Path {REPO} is not a git repository. Fix ~/.claude/review-squad-repo and re-run /update."`

## Step 2 — Record Pre-Pull State

```bash
BEFORE=$(git -C "$REPO" rev-parse HEAD)
BEFORE_SHORT=$(git -C "$REPO" rev-parse --short HEAD)
```

## Step 3 — Git Pull

```bash
git -C "$REPO" pull
```

If exit code is non-zero, stop: `"git pull failed in {REPO}. Resolve the issue manually and re-run /update."`

```bash
AFTER=$(git -C "$REPO" rev-parse HEAD)
AFTER_SHORT=$(git -C "$REPO" rev-parse --short HEAD)
```

If `BEFORE == AFTER`, print `"Already up to date ({BEFORE_SHORT}). No files changed."` and stop — skip all copy steps.

## Step 4 — Identify Changed Files

Get added/modified files only (skip deletions — never auto-delete from ~/.claude/):
```bash
git -C "$REPO" diff --name-only --diff-filter=AM "$BEFORE" "$AFTER" | grep -E '^(agents/|commands/|templates/ship-presentation\.html|hooks/review-squad-gate\.js)'
```

Store as `CHANGED_FILES`. If `hooks/review-squad-gate.js` appears, set `HOOK_CHANGED=true`.

Also capture any deletions separately for the report (do not act on them):
```bash
git -C "$REPO" diff --name-only --diff-filter=D "$BEFORE" "$AFTER" | grep -E '^(agents/|commands/|templates/|hooks/)'
```

## Step 5 — Sync Files

Ensure destination directories exist:
```bash
mkdir -p ~/.claude/agents ~/.claude/commands ~/.claude/commands/gsd ~/.claude/templates ~/.claude/hooks
```

For each file in `CHANGED_FILES`:
- `agents/*.md` → `cp -f "$REPO/{file}" ~/.claude/agents/`
- `commands/*.md` → `cp -f "$REPO/{file}" ~/.claude/commands/`
- `commands/gsd/*.md` → `cp -f "$REPO/{file}" ~/.claude/commands/gsd/`
- `templates/ship-presentation.html` → `cp -f "$REPO/templates/ship-presentation.html" ~/.claude/templates/`
- `hooks/review-squad-gate.js` → `cp -f "$REPO/hooks/review-squad-gate.js" ~/.claude/hooks/`

Track count of files copied.

## Step 6 — Report

```
Review Squad updated  ({BEFORE_SHORT}..{AFTER_SHORT})

Files synced ({N}):
  {file 1}
  {file 2}
  ...

Repo: {REPO}
```

If no Review Squad files were in the diff (repo advanced but only non-tracked files changed):
```
Review Squad repo updated ({BEFORE_SHORT}..{AFTER_SHORT}) but no tracked files changed.
```

If any files were deleted from the repo, note them without acting:
```
Note: the following files were removed from the repo but NOT deleted from ~/.claude/ — remove manually if desired:
  {deleted file 1}
```

If `HOOK_CHANGED=true`, append:
```
NOTICE: hooks/review-squad-gate.js was updated. Verify the hook wiring in settings.json
still points to the correct path. Hook wiring is NOT auto-updated by /update.
Check: cat ~/.claude/settings.json | grep review-squad
```

</process>

<success_criteria>
- [ ] Reads repo path from ~/.claude/review-squad-repo
- [ ] Auto-detects repo path on first run; saves on success
- [ ] Falls back to AskUserQuestion when detection finds zero or multiple candidates
- [ ] Validates path using sentinel file (father-christmas-implement.md) before trusting it
- [ ] Records pre-pull HEAD before git pull
- [ ] Exits cleanly if already up to date — no copies run
- [ ] git pull failure stops execution with a clear message
- [ ] Uses --diff-filter=AM — never auto-deletes files from ~/.claude/
- [ ] Only copies files within agents/, commands/, templates/ship-presentation.html, hooks/review-squad-gate.js
- [ ] Never touches GSD agents or other non-Review-Squad files
- [ ] Summary lists every file synced by name with before/after SHAs
- [ ] Deletions are reported but not acted on
- [ ] Hook-changed warning appears when hooks/review-squad-gate.js is in the diff
</success_criteria>
