# /ship Command — Design Spec

## Overview

`/ship` is a post-review shipping command that generates a self-contained HTML stakeholder presentation, creates a PR, and monitors CI with automatic failure routing to squad agents. It is the final step in the Review Squad lifecycle: `/discuss` → `/research` → `/plan` → `/consult` → `/implement` → `/review` → **`/ship`**.

## Problem

After code passes review, there is no structured process for:
- Communicating changes to non-technical stakeholders
- Creating PRs with meaningful context
- Monitoring CI and resolving failures without manual intervention

Stakeholders currently have no standardized way to understand what shipped, why it matters, or what it looks like in action.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Two-phase (content generation → HTML assembly) | Decouples content from presentation; enables future output formats |
| Agent pairing | Emily (stakeholder) + PM Cory (dev) in parallel | Emily frames user outcomes, Cory has session memory and technical detail |
| Presentation format | Self-contained HTML, all assets inlined | Must work offline, attachable to PR or email |
| Layout | Single page, scrolling sections with divider | Simpler than tabs, stakeholders stop at divider, devs scroll past |
| CI monitoring | Hybrid: inline poll ~5 min, async watcher fallback | Catches most failures in-context; async handles slow pipelines |
| Screenshots | Three-tier: Playwright auto → E2E artifacts → manual fallback | Best-effort, never blocking; additive to presentation |
| Trigger | Explicit `/ship` command | Not auto-fired; shipping is an intentional act |

## Prerequisites

`/ship` enforces a review gate. Before running, it checks `.review-squad/<project>/review-history.md` for the most recent review verdict. If the latest review is not APPROVE + CONFIRM (Nando + Emily), `/ship` exits with:

> "Review not passed. Run `/review` first."

## Permission Model

Invoking `/ship` constitutes explicit user permission to:
- Push the current branch to the remote (`git push -u origin HEAD`)
- Create or update a PR via `gh pr create` / `gh pr edit`
- Commit and push CI failure fixes automatically (up to 3 attempts per failure)

This overrides the global CLAUDE.md restriction on `git push` and `gh` commands for the scope of the `/ship` execution. The user initiates `/ship` knowing it will interact with the remote.

## Command Interface

```
/ship [title or description]
```

**Arguments:**
- `$ARGUMENTS` — Optional. PR title or description of what's shipping. If empty, Emily infers from commit history and plan artifacts.

**Frontmatter:**
```yaml
---
name: ship
description: Generate stakeholder presentation, create PR, and monitor CI with automatic failure resolution
argument-hint: "[PR title or description]"
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
```

## Flow

### Step 1: Gather Context

Derive the project name for `.review-squad/` paths:
```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
```

Read the following to build a context bundle passed to all agents:

| Source | Purpose |
|--------|---------|
| `git log main..HEAD --oneline` | Commit history for this branch |
| `git diff main --stat` | Files changed summary |
| `git diff main` | Full diff for agent analysis |
| `.review-squad/<project>/current-plan.md` | Emily's implementation plan (if exists) |
| `.review-squad/<project>/current-discussion.md` | Emily's discussion summary (if exists) |
| `.review-squad/<project>/current-research.md` | Emily's research findings (if exists) |
| `.review-squad/<project>/current-brief.md` | Nando's implementation brief (if exists) |
| `.review-squad/<project>/review-history.md` | Latest review verdict (gate check) |
| Frontend file detection | Flag for screenshot agent |

Frontend detection uses the same rules as `/review`: files in `frontend/`, `src/components/`, `src/pages/`, `public/`, or with extensions `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`.

### Step 2: Phase 1 — Content Generation (Parallel)

Spawn three agents in parallel using the Agent tool:

#### Emily — Stakeholder Narrative

**Mode:** `present` (new mode added to emily.md)

**Prompt includes:** Context bundle + instruction to produce stakeholder-facing content.

**Output structure (JSON):**
```json
{
  "headline": "One-line summary of what shipped",
  "summary": "2-3 sentences — what changed and why it matters to end users",
  "capabilities": [
    {
      "title": "Capability name",
      "description": "Plain language benefit — what can users do now",
      "type": "new|enhanced|fixed"
    }
  ],
  "before_after": [
    {
      "area": "Feature area",
      "before": "How it worked before",
      "after": "How it works now"
    }
  ],
  "impact": "Who benefits and how — framed for non-technical audience",
  "accessibility_notes": "Any a11y improvements in plain language (empty string if none)"
}
```

**Emily's instructions for this mode:**
- Write for a mixed audience — the least technical person must understand every word
- Frame everything as user outcomes, not code changes ("Users can now..." not "Added endpoint for...")
- `type` field drives visual badges: NEW (green), ENHANCED (blue), FIXED (amber)
- `before_after` is optional — only include when the contrast is meaningful
- Pull from the plan's success criteria and discussion's requirements to ensure coverage

#### PM Cory — Dev Section + Session Memory

**Mode:** `present` (new mode added to pm-cory.md)

**Prompt includes:** Context bundle + SQUAD_DIR path for persistent memory.

**Output structure (JSON):**
```json
{
  "files_changed": {
    "added": ["path/to/new-file.ts"],
    "modified": ["path/to/changed-file.ts"],
    "deleted": ["path/to/removed-file.ts"]
  },
  "testing": {
    "summary": "What was tested and how",
    "results": [
      { "suite": "Unit tests", "passed": 24, "failed": 0 },
      { "suite": "E2E (Playwright)", "passed": 6, "failed": 0 }
    ]
  },
  "architecture_notes": "Key technical decisions, patterns used, notable implementation details",
  "risks_mitigated": [
    "Risk identified in plan → how it was addressed in implementation"
  ],
  "learnings": [
    "New patterns or findings persisted to squad memory this session"
  ],
  "review_verdict": {
    "nando": "APPROVE",
    "emily": "CONFIRM",
    "blockers_resolved": 2,
    "highlights": ["Notable things done well, from review"]
  },
  "pr": {
    "number": null,
    "url": null,
    "branch": "feature/branch-name",
    "base": "main"
  }
}
```

**Cory's instructions for this mode:**
- Load persistent memory from `.review-squad/<project>/` as in all other modes
- `files_changed` comes from git diff, not manual listing
- `testing` pulls from actual test run output if available in session, otherwise from review notes
- `architecture_notes` should reference the Implementation Brief decisions if one exists
- `review_verdict` summarizes the latest review from review-history.md
- After producing output, persist any new learnings (append to learnings.jsonl, update review-history.md)

#### Screenshot Agent — Playwright Capture (Optional)

Only spawned if frontend files are detected in the changeset. This is a general-purpose agent, not a named squad member.

**Three-tier capture strategy:**

**Tier 1 — Automated Playwright:**
Conditions: frontend files changed + `playwright.config.ts` exists at project root

```
1. Detect running dev server (probe ports 3000, 5173, 4321, 8080)
   - If none running, attempt: npm run dev (background, wait up to 15s for ready)
2. Launch Playwright headless Chromium
3. Infer routes from changed files:
   - src/pages/<name>/index.tsx    → /<name>
   - src/pages/<name>/[id].tsx     → /<name>/1
   - src/components/<Name>*        → find importing page
   - app/routes/<name>.tsx         → /<name>
4. Navigate to each route, wait for network idle
5. Capture viewport screenshot at 1280px width
6. Base64 encode each screenshot
7. Clean up (kill dev server if we started it)
```

**Tier 2 — Existing E2E Artifacts:**
If Tier 1 is not possible, check for existing screenshot artifacts:
- `test-results/**/*.png` (Playwright test output)
- `playwright-report/` (HTML report with embedded screenshots)

Extract relevant screenshots, base64 encode.

**Tier 3 — Manual Fallback:**
If no screenshots can be captured:
- Output placeholder entries describing what *should* be screenshotted
- HTML template renders these as labeled placeholder slots

**Output structure (JSON):**
```json
{
  "screenshots": [
    {
      "label": "Dashboard — new filter panel",
      "base64": "data:image/png;base64,...",
      "route": "/dashboard",
      "tier": 1
    }
  ],
  "placeholders": [
    {
      "label": "Mobile responsive view of scheduling modal",
      "description": "Screenshot recommended — could not capture automatically"
    }
  ]
}
```

### Step 3: Phase 2 — HTML Assembly

After all parallel agents complete, the orchestrator assembles the self-contained HTML presentation.

**Assembly mechanism:** The `/ship` orchestrator builds the final HTML string directly — no external template engine. The orchestrator:
1. Reads the agent JSON outputs
2. Constructs HTML sections from the structured data (e.g., iterates `capabilities` array to build badge rows)
3. Omits sections where data is empty (no before_after → no before/after block)
4. Writes the complete HTML document as a single self-contained file

**Template file:** `~/.claude/templates/ship-presentation.html` serves as the reference design — the CSS, layout structure, and visual styling. The orchestrator uses this as a starting point but performs programmatic string construction to insert agent content, not naive find-and-replace. This is necessary because complex sections (capabilities list, test results table, screenshot gallery) require iteration over JSON arrays to produce HTML.

The template is a complete HTML document with:
- All CSS inlined in a `<style>` block (~200 lines, dark theme)
- No external dependencies (fonts use system font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Dark theme: background `#1a1a2e`, text `#e0e0e0`, accent `#6366f1`
- Responsive: readable on mobile but optimized for desktop/laptop viewing

**Document structure:**
```
┌─────────────────────────────────────┐
│ HEADER                              │
│ Release Summary label               │
│ Headline (from Emily)               │
│ PR #N • date • branch → base       │
├─────────────────────────────────────┤
│ STAKEHOLDER SECTION (Emily)         │
│ ┌─ Summary paragraph ─────────────┐ │
│ ├─ Capabilities with badges ──────┤ │
│ │  🟢 NEW   | description         │ │
│ │  🔵 ENHANCED | description      │ │
│ │  🟡 FIXED | description         │ │
│ ├─ Before/After boxes (optional) ─┤ │
│ ├─ Screenshots (if captured) ─────┤ │
│ ├─ Impact statement ──────────────┤ │
│ └─ Accessibility notes (optional) ┘ │
├─── DEVELOPER DETAILS divider ───────┤
│ DEV SECTION (PM Cory)               │
│ ┌─ Files changed (add/mod/del) ───┐ │
│ ├─ Test results table ────────────┤ │
│ ├─ Architecture notes ────────────┤ │
│ ├─ Risks mitigated ──────────────┤ │
│ └─ Review verdict summary ────────┘ │
└─────────────────────────────────────┘
```

**Rendering rules:**
- Capabilities: Rendered as rows with colored badges (NEW=green, ENHANCED=blue, FIXED=amber)
- Before/After: Side-by-side boxes (red-tinted left, green-tinted right)
- Screenshots: Inlined as `<img src="data:image/png;base64,...">` with labels
- Placeholders: Rendered as dashed-border boxes with description text
- Files: Grouped by added/modified/deleted with color coding
- Test results: Table with suite name, passed count, failed count
- Empty optional sections (before_after, accessibility_notes, screenshots) are omitted entirely

**Output path:** `.review-squad/<project>/presentations/{{date}}-{{slug}}.html`

Where `slug` is derived from the headline (lowercase, hyphens, max 40 chars).

### Step 4: PR Creation

After HTML assembly:

0. **Ensure branch is pushed.** If the branch has no upstream remote, push first:
   ```bash
   git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || git push -u origin HEAD
   ```

1. Check if a PR already exists for the current branch:
   ```bash
   gh pr view --json number,url 2>/dev/null
   ```

2. **If no PR exists:** Create one.
   ```bash
   gh pr create --title "{{headline}}" --body "$(cat <<'EOF'
   ## Summary
   {{summary}}

   ## Changes
   {{capabilities as markdown bullets}}

   ## Testing
   {{test summary}}

   ## Presentation
   Full stakeholder presentation attached: `{{presentation_filename}}`

   🤖 Generated with [Claude Code](https://claude.com/claude-code) + Review Squad
   EOF
   )"
   ```

3. **If PR exists:** Update the body to include the presentation reference.

4. Update PM Cory's JSON output with the PR number and URL.

5. Edit the existing HTML file to replace the placeholder PR reference (`PR #...`) with the actual PR number and URL. This is a surgical string replacement in the already-written file, not a full re-render.

6. Display the PR URL and presentation file path to the user.

### Step 5: CI Monitoring (Hybrid)

#### Inline Polling Phase

```
POLL_INTERVAL = 30 seconds
MAX_POLLS = 10 (total ~5 minutes)
poll_count = 0

while poll_count < MAX_POLLS:
    checks = gh pr checks <PR#> --json name,state,conclusion

    if all checks conclusion == "SUCCESS":
        report "✓ All CI checks passed. PR #<N> is green."
        done

    if any check conclusion == "FAILURE":
        enter Failure Resolution (Step 6)
        done

    if all checks state != "PENDING":
        # Mix of success and other terminal states
        report status, done

    poll_count++
    wait POLL_INTERVAL
```

#### Async Watcher Fallback

If checks are still pending after inline polling:

Generate `.review-squad/<project>/pr-watcher.sh`:
```bash
#!/bin/bash
PR_NUM={{pr_number}}
PROJECT_DIR={{project_dir}}
SQUAD_DIR={{squad_dir}}
MAX_ATTEMPTS=30  # 30 min at 60s intervals
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    CHECKS=$(gh pr checks $PR_NUM --json name,state,conclusion 2>/dev/null)

    # Check for any failure
    if echo "$CHECKS" | jq -e '.[] | select(.conclusion == "FAILURE")' > /dev/null 2>&1; then
        FAILED=$(echo "$CHECKS" | jq -r '.[] | select(.conclusion == "FAILURE") | .name')
        LOGS=$(gh pr checks $PR_NUM 2>/dev/null)
        cat > "${SQUAD_DIR}/pr-failure.md" << FAIL_EOF
# PR Failure — #${PR_NUM}
**Detected:** $(date -Iseconds)
**Failed checks:**
${FAILED}

**Check output:**
${LOGS}

**Files in PR:**
$(gh pr view $PR_NUM --json files --jq '.files[].path' 2>/dev/null)

**Route to:** FC (build/type/test errors) + Jared (CI config/security/integration)
FAIL_EOF
        exit 0
    fi

    # Check for all success
    if echo "$CHECKS" | jq -e 'all(.conclusion == "SUCCESS")' > /dev/null 2>&1; then
        cat > "${SQUAD_DIR}/pr-success.md" << SUCCESS_EOF
# PR Success — #${PR_NUM}
**Detected:** $(date -Iseconds)
All CI checks passed.
SUCCESS_EOF
        exit 0
    fi

    ATTEMPT=$((ATTEMPT + 1))
    sleep 60
done

echo "Timed out waiting for CI checks on PR #${PR_NUM}" > "${SQUAD_DIR}/pr-timeout.md"
```

Tell the user:
> "CI checks still running. Watcher script dropped at `.review-squad/<project>/pr-watcher.sh`. Run it in a terminal tab: `bash .review-squad/<project>/pr-watcher.sh &`"
> "If checks fail, the next Claude session will pick it up and offer to route to FC + Jared."

**Known limitation:** The watcher result is passive — it will be detected on the next tool invocation in any Claude Code session for this project, or on the next session start. There is no push notification to the user's terminal. The user must start or resume a Claude Code session to trigger the hook pickup.

### Step 6: Failure Resolution

When a CI failure is detected (inline or via `pr-failure.md` pickup):

#### Failure Classification

| Signal in Check Output | Routed To | Rationale |
|------------------------|-----------|-----------|
| Type errors (`TS\d+`, `tsc`) | FC | Code quality, type system domain |
| Build failures (`build failed`, `compilation error`) | FC | Backend/build domain |
| Lint errors (`eslint`, `prettier`) | FC | Code quality domain |
| Unit test failures (`FAIL`, `AssertionError`) | FC + Jared (parallel) | FC: logic errors; Jared: integration/security test logic |
| E2E test failures (`playwright`, `cypress`) | FC + Jared (parallel) | FC: code fixes; Jared: integration. (Stevey is review-only, not used for CI fixes.) |
| CI config failures (`workflow`, `pipeline`, `docker`) | Jared | Systems integration domain |
| Security scan failures (`snyk`, `dependabot`, `audit`) | Jared | Security domain |
| Unknown/unclassified | FC + Jared (parallel) | Both analyze, Nando-lite synthesis not needed for CI fixes |

#### Agent Prompt for Failure Resolution

Each routed agent receives:
- The failing check name and log output
- The PR diff (files they changed)
- The Implementation Brief (if exists) for architectural context
- Instruction: "Fix the CI failure. Commit the fix atomically. Do not change unrelated code."

After fix is pushed:
- Re-enter inline monitoring (Step 5) for the new commit
- Max 3 resolution attempts before surfacing to user: "CI still failing after 3 fix attempts. Manual intervention needed."

## Hook Extension

### `review-squad-gate.js` Changes

Add a new check at the top of the hook (runs on session start / first tool use):

```javascript
// Check for pr-failure.md from async watcher
const failurePath = path.join(squadDir, 'pr-failure.md');
if (fs.existsSync(failurePath)) {
  const failureContent = fs.readFileSync(failurePath, 'utf-8');
  message = `PR FAILURE DETECTED: A CI check failed after you left.\n\n` +
    `${failureContent}\n\n` +
    `Route to FC + Jared for resolution? (They will read the failure, diagnose, fix, and push.)`;
  // Don't delete the file yet — let the resolution process clean it up after fix
}
```

Also check for `pr-success.md` (informational):
```javascript
const successPath = path.join(squadDir, 'pr-success.md');
if (fs.existsSync(successPath)) {
  message = `PR SUCCESS: All CI checks passed. PR is green and ready for merge.`;
  fs.unlinkSync(successPath); // Clean up
}
```

## Agent Mode Additions

### Emily — `present` Mode

Added to `~/.claude/agents/emily.md` under `<modes>`, after the Review mode:

```markdown
## Mode: Present
You produce the stakeholder-facing content for the shipping presentation. Your output is structured JSON consumed by the `/ship` assembler.

### Process:
1. **Read all prior phase artifacts** — plan, discussion, research, review verdict. These inform the narrative.
2. **Read the git log and diff** — understand exactly what changed at the code level.
3. **Translate code changes to user outcomes** — every capability must be framed as what the user can now do, not what the code does.
4. **Write the headline** — one line, compelling, no jargon. This is the first thing stakeholders see.
5. **Categorize capabilities** — each as `new` (didn't exist before), `enhanced` (existed but improved), or `fixed` (was broken, now works).
6. **Assess before/after** — only include when the contrast is meaningful and easily understood.
7. **Write the impact statement** — who benefits, how, why it matters to the business.
8. **Call out accessibility improvements** — always, even if minor. Omit only if genuinely none.

### Output: JSON matching the schema in the /ship spec
Produce ONLY the JSON object. No markdown wrapping, no commentary.

### Writing guidelines:
- Mixed audience — the least technical person must understand every word
- "Users can now..." not "Added endpoint for..."
- Specific over vague — "Schedule emails for any future date" not "Improved email functionality"
- Honest — don't oversell. If it's a bug fix, say so clearly.
- Pull from plan success criteria and discussion requirements to ensure nothing is missed
```

### PM Cory — `present` Mode

Added to `~/.claude/agents/pm-cory.md` under `<modes>`, after the Review mode:

```markdown
## Mode: Present
You produce the developer-facing content for the shipping presentation and persist session learnings. Your output is structured JSON consumed by the `/ship` assembler.

### Process:
1. **Load persistent context** from `.review-squad/<project-name>/` as in all other modes
2. **Read git diff and log** — build the files_changed list from actual git data, not memory
3. **Gather test results** — from session test run output if available, otherwise from review notes
4. **Summarize architecture decisions** — reference the Implementation Brief if one exists
5. **Extract review verdict** — from review-history.md, including blockers resolved and highlights
6. **Identify risks mitigated** — map plan risks to how they were addressed in implementation
7. **Persist learnings** — append new findings to learnings.jsonl, update review-history.md with the ship event

### Output: JSON matching the schema in the /ship spec
Produce ONLY the JSON object. No markdown wrapping, no commentary.

### Data sourcing:
- `files_changed`: from `git diff main --name-status`, categorized by status letter (A/M/D)
- `testing.results`: from test runner output in session, or from review notes if no test output available
- `architecture_notes`: from Implementation Brief + your own observations during implementation coordination
- `review_verdict`: from `.review-squad/<project-name>/review-history.md`, most recent entry
- `pr.branch`: from `git branch --show-current`
- `pr.base`: from `git rev-parse --abbrev-ref main` or the base branch used in review
```

## File Inventory

| File | Type | Purpose |
|------|------|---------|
| `~/.claude/commands/ship.md` | Command | Orchestrator for the full /ship flow |
| `~/.claude/templates/ship-presentation.html` | Template | Reference HTML design — CSS, layout, visual styling used by orchestrator during assembly |
| `~/.claude/agents/emily.md` | Agent (modified) | Add `present` mode |
| `~/.claude/agents/pm-cory.md` | Agent (modified) | Add `present` mode |
| `~/.claude/hooks/review-squad-gate.js` | Hook (modified) | Add pr-failure.md / pr-success.md detection |

## Output Artifacts

| Artifact | Location | Lifetime |
|----------|----------|----------|
| Presentation HTML | `.review-squad/<project>/presentations/<date>-<slug>.html` | Persistent |
| Watcher script | `.review-squad/<project>/pr-watcher.sh` | Deleted after PR resolves |
| PR failure context | `.review-squad/<project>/pr-failure.md` | Deleted after resolution |
| PR success marker | `.review-squad/<project>/pr-success.md` | Deleted on next session start |

## Success Criteria

- [ ] Review gate enforced — `/ship` refuses to run without APPROVE + CONFIRM
- [ ] Emily produces stakeholder-readable content with no jargon
- [ ] PM Cory produces accurate dev section from actual git/test data
- [ ] Screenshots captured automatically when possible, graceful fallback when not
- [ ] HTML is fully self-contained — opens correctly from filesystem with no network
- [ ] PR created with meaningful body derived from presentation content
- [ ] Inline CI monitoring catches failures within ~5 minutes
- [ ] Watcher script correctly detects success/failure for async cases
- [ ] Hook picks up pr-failure.md and routes to FC + Jared on next session
- [ ] Failure resolution agents can diagnose and fix common CI failures
- [ ] Max 3 auto-fix attempts before surfacing to user
- [ ] All artifacts written to .review-squad/ (gitignored)
