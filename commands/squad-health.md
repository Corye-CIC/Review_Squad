---
name: squad-health
description: Audit Review Squad installation integrity — agent files, commands, hooks, project-rules, and project-local squad state
argument-hint: "[--fix] [--verbose]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
<objective>
Checklist-style integrity audit of the Review Squad installation. Catches drift when agent files are deleted, hooks lose their wiring, `/update-reviewsquad` hasn't run recently, or a project is missing its `.review-squad/` scaffolding.

Answers: "Is the squad actually installed correctly?" Replaces ad-hoc troubleshooting when something stops working.
</objective>

<context>
$ARGUMENTS:
- `--fix` — attempt to auto-repair safe issues (create missing dirs, add `.review-squad/` to `.gitignore`). Never touches `settings.json` — prompts user for manual fix.
- `--verbose` — include passing checks in output, not just failures.

No arguments: shows only failures, summary pass/fail count.
</context>

## Gotchas
- **Never modifies settings.json.** Hook wiring issues are reported but user fixes them manually — settings.json is too load-bearing to mutate silently.
- **Checks current cwd's `.review-squad/` state.** If run outside any project, skips project-local checks with a note.
- **Version drift check is best-effort.** Compares `~/.claude/review-squad-version` to the latest upstream SHA via `curl` to GitHub. If offline, skips the check with a note.
- **Does not validate agent file semantics.** Only checks that files exist and have valid frontmatter — does not verify prompts are coherent or up to date. For that, run the Review Squad on the agent files themselves via `/review agents/*.md`.
- **Custom agent detection.** Files under `~/.claude/agents/` starting with `custom-` are NOT expected; they're user-created. Only the 25 canonical squad agents are required.

<process>

## Step 1: Expected inventory

```bash
EXPECTED_AGENTS=(
  emily-discuss emily-research emily-plan emily-implement emily-review emily-present
  father-christmas-consult father-christmas-implement father-christmas-audit father-christmas-review father-christmas-craft
  jared-consult jared-implement jared-audit jared-review jared-security-intelligence
  nando-consult nando-implement nando-review nando-intelligence
  pm-cory-early pm-cory-consult pm-cory-implement pm-cory-review pm-cory-present
  stevey-boy-choi-consult stevey-boy-choi-implement stevey-boy-choi-review stevey-design-principles
)
EXPECTED_COMMANDS=(
  discuss research plan consult implement review review-auto ship fleet ui-iterate
  handoff audit quick create-agent sync-upstream update-reviewsquad
  debate debate-false-positive squad-metrics squad-health
)
EXPECTED_SUBDIR_COMMANDS=(agent-chat/on agent-chat/off)
EXPECTED_PROJECT_RULES=(commit-hygiene dev-environment)
EXPECTED_HOOKS=(review-squad-gate review-squad-context-monitor review-squad-statusline squad-telemetry)
EXPECTED_TEMPLATES=(ship-presentation.html)
```

## Step 2: Run checks

### 2a. Agent files
For each agent in `EXPECTED_AGENTS`:
- Check `~/.claude/agents/<agent>.md` exists and is a regular file
- Check frontmatter parses (first `---` line, name field, description field)

### 2b. Commands
For each command in `EXPECTED_COMMANDS` and `EXPECTED_SUBDIR_COMMANDS`:
- Check `~/.claude/commands/<command>.md` exists
- Check frontmatter parses

### 2c. Project rules
For each rule in `EXPECTED_PROJECT_RULES`:
- Check `~/.claude/project-rules/<rule>.md` exists

### 2d. Hooks
For each hook in `EXPECTED_HOOKS`:
- Check `~/.claude/hooks/<hook>.js` exists
- Check it's referenced in `~/.claude/settings.json` (grep for the filename)

### 2e. Settings.json validity
```bash
jq empty ~/.claude/settings.json 2>&1 || echo "INVALID JSON"
```

### 2f. Project-local state (if cwd is a repo)
- `.review-squad/<project-name>/` directory exists
- `.review-squad/<project-name>/agent-notes/` exists
- `.review-squad/` is in `.gitignore`

### 2g. Version drift
```bash
CURRENT=$(cat ~/.claude/review-squad-version 2>/dev/null)
LATEST=$(curl -sf "https://api.github.com/repos/Corye-CIC/Review_Squad/commits/main" 2>/dev/null \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['sha'])" 2>/dev/null)
```
If `CURRENT` != `LATEST` and both are valid SHAs, report as "Outdated — run /update-reviewsquad".

### 2h. gh auth state (if `gh` is installed)
```bash
gh auth status 2>&1 | grep "Logged in" | head -5
```
Report the active account. Warn if pushing to `Corye-CIC/Review_Squad` requires a different account than currently active.

## Step 3: Report

Default (without `--verbose`):
```markdown
# Review Squad — Health Check

## Failures (<count>)

- [ ] MISSING: `~/.claude/agents/emily-plan.md`
      Fix: /update-reviewsquad
- [ ] MISSING: `~/.claude/hooks/squad-telemetry.js`
      Fix: /update-reviewsquad
- [ ] settings.json hook: squad-telemetry.js not referenced in PostToolUse
      Fix: add the hook entry manually (see Review Hook wiki page)
- [ ] Outdated: local at abc1234, latest at def5678 (3 commits behind)
      Fix: /update-reviewsquad

## Passing
- Agents: 28/29
- Commands: 20/20
- Project rules: 2/2
- Hooks: 3/4 installed, 3/4 wired
- Settings.json: valid
- Current project (.review-squad/): 3/3

Summary: 4 failures, 28 passing. Run /squad-health --fix to auto-repair safe items.
```

With `--verbose`: include PASSING lines for every check.

## Step 4: Auto-fix (if `--fix` flag set)

Safe auto-fixes:
- Create missing dirs: `.review-squad/<project>/agent-notes/`
- Add `.review-squad/` to `.gitignore` if missing

Never auto-fix:
- Missing agents or commands → directs to `/update-reviewsquad`
- settings.json changes → directs user to Review Hook wiki
- Version drift → directs to `/update-reviewsquad`
- gh auth → directs to `gh auth switch`

After auto-fix, re-run all checks and report remaining failures.

</process>

<success_criteria>
- [ ] Every agent, command, project-rule, hook, and template checked against expected inventory
- [ ] Missing files reported with concrete fix instructions (which command to run)
- [ ] Settings.json JSON validity verified
- [ ] Project-local .review-squad/ state audited when in a repo
- [ ] Version drift detected against upstream SHA
- [ ] gh auth state reported for push clarity
- [ ] Auto-fix never mutates settings.json
- [ ] Default output is failure-focused; --verbose includes passes
</success_criteria>
