# `/create-agent` Command Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/create-agent` command that guides users through creating a custom agent via 5-question Q&A, plus the two companion changes to `/update` and `/quick` that make custom agents safe and dispatchable.

**Architecture:** Three command files changed. `/update` gets a `custom-` skip filter in its download step. `/quick` gets a custom-agent fallback lookup that fires before existing validation. `/create-agent` is a new command that runs a template-first Q&A, shows a preview, and writes the agent file on confirmation.

**Tech Stack:** Claude Code slash commands (markdown), Bash (for file checks in `/quick` and `/update`), no external dependencies.

**Spec:** `docs/superpowers/specs/2026-03-25-create-agent-command-design.md`

---

## Chunk 1: Companion Changes — `/update` and `/quick`

### Task 1: Add `custom-` skip filter to `/update`

**Files:**
- Modify: `commands/update.md` (Step 4 — Download Files section)

The current Step 4 downloads every file in `FILES_TO_SYNC` unconditionally. We need to skip any file whose destination basename starts with `custom-`. This protects user-created agents on both first-run (contents API) and incremental (compare API) paths.

- [ ] **Step 1: Locate the exact insertion point**

Open `commands/update.md`. Find Step 4 — it starts at the line:
```
For each file in `FILES_TO_SYNC`, download it to the matching destination:
```
The skip filter goes immediately before the download loop, after the `mkdir -p` block.

- [ ] **Step 2: Insert the custom- skip filter**

After the `mkdir -p` line and before the download destination list, add:

```
Skip any file where the destination basename starts with `custom-`:
- `agents/custom-*.md` — user-created agents; never overwrite
```

The full updated Step 4 download loop instruction should read:

```
For each file in `FILES_TO_SYNC`, **skip it if its basename starts with `custom-`**, then download the remainder to the matching destination:
- `agents/NAME.md` → `~/.claude/agents/NAME.md`  *(skip if NAME starts with `custom-`)*
- `commands/NAME.md` → `~/.claude/commands/NAME.md`
- `commands/gsd/NAME.md` → `~/.claude/commands/gsd/NAME.md`
- `templates/ship-presentation.html` → `~/.claude/templates/ship-presentation.html`
- `hooks/review-squad-gate.js` → `~/.claude/hooks/review-squad-gate.js`
```

Also update the `<success_criteria>` block — add:
```
- [ ] Never overwrites files in ~/.claude/agents/ whose basename starts with `custom-`
```

- [ ] **Step 3: Verify the edit looks correct**

Read back `commands/update.md` Step 4 and confirm:
- The skip rule appears before the destination list
- `*(skip if NAME starts with `custom-`)*` annotation is on the `agents/` line
- No other steps were accidentally modified

- [ ] **Step 4: Commit**

```bash
git add commands/update.md
git commit -m "feat: skip custom- agents in /update download step"
```

---

### Task 2: Add custom agent fallback to `/quick`

**Files:**
- Modify: `commands/quick.md` (`<parsing>` section — before existing validation)

The fallback must run before `/quick`'s mode validation so that `custom-name:anything` doesn't trigger "Invalid mode" before the custom check fires. It treats matching agents as Path 3 (direct dispatch, no pre-flight).

- [ ] **Step 1: Locate the insertion point**

Open `commands/quick.md`. Find the `<parsing>` section. The insertion goes at the very top of the parsing steps — before "Parse `$ARGUMENTS` right-to-left" — as a new numbered step 0.

- [ ] **Step 2: Insert custom agent pre-check as Step 0**

Add the following block immediately after the `<parsing>` heading and before `## Argument Parsing`:

````markdown
## Custom Agent Pre-Check (runs before all other parsing)

Before any alias validation or mode checking, scan the last whitespace-separated segment of `$ARGUMENTS` for custom agent tokens:

1. Strip a trailing `+nando` from `$ARGUMENTS` first (independent of the main parsing strip — both must happen). Take the last whitespace-separated segment of the result and split on commas.
2. For each token, strip any `:mode` suffix to get the bare name.
3. Check if the bare name starts with `custom-` **and** `~/.claude/agents/{bare-name}.md` exists:
   ```bash
   [ -f "$HOME/.claude/agents/{bare-name}.md" ]
   ```
4. If **any** token is a confirmed custom agent:
   - If the token had a `:mode` suffix, emit: `"Note: {bare-name} is a single-mode agent — :{mode} suffix ignored."`
   - Treat ALL confirmed custom tokens as **Path 3 explicit dispatch** with `subagent_type: {bare-name}` (no mode suffix appended).
   - Non-custom tokens in the same list must have explicit `:mode` suffixes (standard Path 3 rule). If any don't, stop: `"Mixed agent list: when using custom agents, all squad agents must have explicit modes (e.g. jared:review)."`
   - Skip all remaining parsing steps. Go directly to Path 3 execution.
5. If **no** custom agents found, continue to normal `## Argument Parsing` below.
````

- [ ] **Step 3: Verify the edit**

Read back the `<parsing>` section and confirm:
- Custom Agent Pre-Check appears before `## Argument Parsing`
- The 5-step logic is intact
- The "Mixed agent list" error message is present
- Existing `## Argument Parsing` content is untouched

- [ ] **Step 4: Commit**

```bash
git add commands/quick.md
git commit -m "feat: add custom agent fallback to /quick before mode validation"
```

---

### Task 3: Install companion changes locally and smoke-test

- [ ] **Step 1: Install both updated commands**

```bash
cp commands/update.md ~/.claude/commands/update.md
cp commands/quick.md ~/.claude/commands/quick.md
echo "installed"
```

- [ ] **Step 2: Verify custom- skip filter logic by dry-run**

```bash
# Simulate what /update Step 4 would do with a custom- file in the list
echo "agents/custom-payments-expert.md" | python3 -c "
import sys
for line in sys.stdin:
    name = line.strip()
    basename = name.split('/')[-1]
    if basename.startswith('custom-'):
        print(f'SKIP: {name}')
    else:
        print(f'DOWNLOAD: {name}')
"
```
Expected output: `SKIP: agents/custom-payments-expert.md`

- [ ] **Step 3: File-system sanity check only**

```bash
# Confirm bash file creation and deletion works as expected for the custom- path
# NOTE: This does NOT verify the /quick pre-check lookup — that is tested in Task 10 Steps 3-4
echo "---
name: custom-test-agent
description: test
tools: Read
---
test" > ~/.claude/agents/custom-test-agent.md
ls ~/.claude/agents/custom-test-agent.md && echo "exists — file creation OK"
rm ~/.claude/agents/custom-test-agent.md
echo "deleted — cleanup OK"
```

The `/quick` pre-check lookup (does it actually dispatch `custom-name` correctly?) is verified end-to-end in Task 10 Steps 3 and 4 after `/create-agent` is complete.

- [ ] **Step 4: Commit verification complete**

No commit needed — this task is verification only.

---

## Chunk 2: The `/create-agent` Command

### Task 4: Create `commands/create-agent.md` — skeleton and frontmatter

**Files:**
- Create: `commands/create-agent.md`

- [ ] **Step 1: Create the file with frontmatter and objective**

Create `commands/create-agent.md` with:

```markdown
---
name: create-agent
description: Interactively create a custom Claude Code agent via Q&A and write it to ~/.claude/agents/
argument-hint: ""
allowed-tools:
  - Bash
  - AskUserQuestion
---
<objective>
Guide the user through creating a custom Claude Code agent via a 5-question Q&A. Template-first: user picks a starting template, then customises name, specialization, tone, and tools. Shows a full preview before writing anything. Outputs `~/.claude/agents/custom-{name}.md`.

Custom agents use the `custom-` prefix so `/update` never overwrites them and they can be dispatched via `/quick <task> custom-{name}`.
</objective>
```

- [ ] **Step 2: Commit skeleton**

```bash
git add commands/create-agent.md
git commit -m "feat: scaffold /create-agent command skeleton"
```

---

### Task 5: Add template definitions

**Files:**
- Modify: `commands/create-agent.md`

- [ ] **Step 1: Add the templates block**

Append to `commands/create-agent.md`:

````markdown
<templates>

Each template defines: default_tools, focus_areas (3-5 bullets), role_framing.

**security-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "security-focused code reviewer specialising in {specialization}"
- focus_areas:
  - Input validation and sanitization at all system boundaries
  - Authentication and authorisation checks — missing guards, privilege escalation
  - Injection vulnerabilities: SQL, XSS, command injection, path traversal
  - Secrets and credentials — hardcoded values, logged tokens, insecure storage
  - Dependency vulnerabilities and insecure configurations

**code-quality-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "code quality reviewer specialising in {specialization}"
- focus_areas:
  - Naming — clear, intention-revealing names for variables, functions, types
  - Structure — single responsibility, appropriate abstraction levels
  - DRY — duplication, opportunities to extract shared logic
  - Patterns — consistent use of established patterns; deviations flagged
  - Readability — code that reads like well-written prose, minimal comments needed

**domain-expert**
- default_tools: Read, Grep, Glob, Bash
- role_framing: "domain expert in {specialization}"
- focus_areas: (derived from specialization — generate 3-5 relevant checks based on the domain the user describes in Q3)

**documentation-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "documentation reviewer specialising in {specialization}"
- focus_areas:
  - Accuracy — does the documentation match what the code actually does?
  - Completeness — are parameters, return values, errors, and edge cases covered?
  - Comment rot — outdated comments that contradict current behaviour
  - Stale examples — code examples that no longer compile or run correctly
  - Missing docs — public APIs, complex functions, and non-obvious decisions without explanation

**performance-reviewer**
- default_tools: Read, Grep, Glob, Bash
- role_framing: "performance reviewer specialising in {specialization}"
- focus_areas:
  - N+1 queries — loops that trigger repeated database or API calls
  - Memory — unbounded collections, large allocations, potential leaks
  - Redundant calls — duplicate API calls, repeated expensive computations
  - Hot paths — expensive operations in tight loops or frequently called functions
  - Missing caching — repeated identical work that could be memoised or cached

**blank**
- default_tools: Read, Grep, Glob
- role_framing: (derived entirely from user's Q3 free-form description)
- focus_areas: (derived entirely from user's Q3 free-form description)

</templates>
````

- [ ] **Step 2: Verify template block reads correctly**

Read back `commands/create-agent.md` and confirm all 6 templates are present with their fields.

- [ ] **Step 3: Commit**

```bash
git add commands/create-agent.md
git commit -m "feat: add 6 template definitions to /create-agent"
```

---

### Task 6: Add the Q&A process — Questions 1–3

**Files:**
- Modify: `commands/create-agent.md`

- [ ] **Step 1: Add the process block opening and Q1–Q3**

Append to `commands/create-agent.md`:

````markdown
<process>

## Step 1 — Q1: Choose a template

Ask:
```
Which type of agent do you want to create?

A) Security reviewer — auth, injection, secrets, input validation
B) Code quality reviewer — naming, structure, DRY, patterns
C) Domain expert — business logic for a specific domain you define
D) Documentation reviewer — accuracy, completeness, comment rot
E) Performance reviewer — N+1 queries, memory, redundant calls
F) Blank — start from scratch, you define everything
```

Store the selected template as `TEMPLATE`. Load its `default_tools`, `role_framing`, and `focus_areas` from the `<templates>` block above.

## Step 2 — Q2: Name and validation

Ask:
```
What should this agent be called?

This becomes the filename (custom-{name}.md) and how you reference it in /quick.
Keep it short, lowercase, hyphens only — e.g. payments-expert, api-contracts, hipaa-reviewer.
```

**Validate the input:**
- Reject if it contains uppercase letters, spaces, or characters other than `a-z`, `0-9`, `-`
- Reject if it starts or ends with a hyphen
- If invalid, explain the rule and ask again

**Check for existing file:**
```bash
ls "$HOME/.claude/agents/custom-{name}.md" 2>/dev/null
```
If it exists, warn immediately:
```
⚠️  ~/.claude/agents/custom-{name}.md already exists. Overwrite? (yes/no)
```
If "no" → return to Q2 and ask for a different name.
If "yes" → set `OVERWRITE_APPROVED=true`.

Store validated name as `NAME`. The filename will be `custom-{NAME}.md`. The frontmatter `name:` field will be `custom-{NAME}`. In prose and the `<role>` block, use bare `{NAME}` as the display name.

## Step 3 — Q3: Specialization

For all templates except `blank`, ask:
```
What should this agent focus on specifically?
One or two sentences — e.g. "OAuth flows and JWT validation" or "payments processing and PCI compliance".
```

For `blank`, ask:
```
Describe this agent's role and what it should focus on.
This defines everything — be as specific as you like.
```

Store as `SPECIALIZATION`.

For `domain-expert` and `blank`: generate the `focus_areas` from `SPECIALIZATION` after Q3 is answered (3-5 relevant bullet points derived from what the user described). For all other templates, use the pre-defined `focus_areas` from `<templates>`, optionally refining the wording to reflect `SPECIALIZATION`.

````

- [ ] **Step 2: Verify Q1–Q3 steps are present and correctly formatted**

Read back the process block and confirm each step heading, the question text, and the validation rules are intact.

- [ ] **Step 3: Commit**

```bash
git add commands/create-agent.md
git commit -m "feat: add Q1-Q3 to /create-agent process"
```

---

### Task 7: Add Q4–Q5 and personality tone map

**Files:**
- Modify: `commands/create-agent.md`

- [ ] **Step 1: Add Q4, Q5, and the tone map**

Append to `commands/create-agent.md` (inside `<process>`, continuing from Q3):

````markdown
## Step 4 — Q4: Personality tone

Ask:
```
Pick a tone for this agent:

A) Direct and blunt — gets to the point, no sugarcoating
B) Collaborative and warm — constructive, encouraging, explains reasoning
C) Formal and precise — measured, thorough, technical language
D) Neutral — no strong personality, just findings
```

Store as `TONE`. Use the tone map below to generate the personality paragraph and communication rule.

**Tone map:**

| Tone | Personality paragraph | Communication rule |
|------|----------------------|-------------------|
| A (Direct) | "Direct and no-nonsense. You don't sugarcoat. You respect the developer's time by being clear and actionable. You give verdicts, not suggestions." | "State findings plainly. Lead with the problem, then the fix. No hedging." |
| B (Collaborative) | "Warm and constructive. You explain your reasoning, acknowledge trade-offs, and frame findings as opportunities. You're a senior colleague, not a judge." | "Frame every finding with context. Explain why it matters before saying what to change." |
| C (Formal) | "Methodical and precise. You use technical terminology accurately, structure findings systematically, and distinguish between confirmed issues and observations." | "Use precise technical language. Categorise findings by severity. Avoid colloquialisms." |
| D (Neutral) | "Objective and minimal. You report findings without editorialising. Your output is a list of observations, not a narrative." | "Report only. No personality. No recommendations beyond the finding itself." |

## Step 5 — Q5: Tools

Show the template's pre-selected tools and ask:
```
Suggested tools for this agent: {TEMPLATE default_tools}

Add or remove any? Valid options: Read, Write, Edit, Bash, Grep, Glob
(Say "looks good" to accept the defaults)
```

If the user requests a tool not in the valid list, respond:
```
"{requested}" is not a valid tool. Valid tools are: Read, Write, Edit, Bash, Grep, Glob.
```
Ask again until the list is valid.

Store final list as `TOOLS`.

````

- [ ] **Step 2: Verify Q4 tone map and Q5 tool validation are present**

- [ ] **Step 3: Commit**

```bash
git add commands/create-agent.md
git commit -m "feat: add Q4-Q5 and tone map to /create-agent"
```

---

### Task 8: Add preview, generation logic, and write step

**Files:**
- Modify: `commands/create-agent.md`

- [ ] **Step 1: Add generation and preview block**

Append to `commands/create-agent.md` (continuing inside `<process>`):

````markdown
## Step 6 — Generate and preview

Using `TEMPLATE`, `NAME`, `SPECIALIZATION`, `TONE`, and `TOOLS`, generate the full agent file content:

```markdown
---
name: custom-{NAME}
description: {one-line description: combine role_framing with SPECIALIZATION, max 120 chars}
tools: {TOOLS as comma-separated list}
---

<role>
You are {NAME} — {role_framing with SPECIALIZATION substituted in}.

{personality paragraph from tone map}
</role>

<focus>
{focus_areas as bullet list — 3-5 items, refined to reflect SPECIALIZATION}
</focus>

<rules>
- Only review files within your specialization — flag anything outside your domain as out of scope
- Be specific: point to exact file and line number when flagging issues
- {communication rule from tone map}
</rules>
```

Present the preview:
```
Here's your agent — does this look right?

─────────────────────────────────────────
Agent: custom-{NAME}
File:  ~/.claude/agents/custom-{NAME}.md
─────────────────────────────────────────
{full generated file content verbatim}
─────────────────────────────────────────

Type "yes" to write the file, or tell me what to change.
```

**If the user requests changes:**
Apply the requested change to the generated content, then re-enforce structural constraints before showing the preview again:
- `name:` frontmatter field must remain `custom-{NAME}`
- `tools:` must only contain values from: Read, Write, Edit, Bash, Grep, Glob
- `<role>`, `<focus>`, and `<rules>` blocks must all be present
- Content changes (tone, wording, focus bullet rewording) are applied freely

Show the preview again and repeat until the user confirms.

## Step 7 — Write the file

On confirmation ("yes"):

```bash
mkdir -p "$HOME/.claude/agents"
```

**Check for overwrite one final time** (in case the file was created between Q2 and now):
```bash
ls "$HOME/.claude/agents/custom-{NAME}.md" 2>/dev/null
```
If it exists and `OVERWRITE_APPROVED` is not true, ask:
```
⚠️  ~/.claude/agents/custom-{NAME}.md already exists. Overwrite? (yes/no)
```
If "no" → return to Q2.

Write the confirmed content to `~/.claude/agents/custom-{NAME}.md`.

Print:
```
✓ Agent written to ~/.claude/agents/custom-{NAME}.md
Restart Claude Code or start a new session to activate it.
Use it with: /quick <task> custom-{NAME}
```

</process>
````

- [ ] **Step 2: Verify the full `<process>` block is correctly closed**

Read back `commands/create-agent.md` and confirm:
- `<process>` opens after `<templates>`
- Steps 1-7 are all present
- `</process>` closes the block

- [ ] **Step 3: Commit**

```bash
git add commands/create-agent.md
git commit -m "feat: add preview, generation, and write steps to /create-agent"
```

---

### Task 9: Add success criteria and install locally

**Files:**
- Modify: `commands/create-agent.md`
- Install: `~/.claude/commands/create-agent.md`

- [ ] **Step 1: Add success criteria block**

Append to `commands/create-agent.md`:

````markdown
<success_criteria>
- [ ] Command runs with no arguments — all information gathered via Q&A
- [ ] All 6 templates produce a working, well-structured agent file
- [ ] Q2 name input is validated — rejects uppercase, spaces, special characters, leading/trailing hyphens
- [ ] Q2 checks for existing custom-{name}.md and triggers overwrite warning immediately
- [ ] Q5 tool list defaults from template; invalid tool names are rejected with the valid list
- [ ] Preview shown before any file is written
- [ ] Change requests regenerate the preview; structural constraints re-enforced on each regeneration
- [ ] Overwrite warning shown when custom-{name}.md exists; returns to Q2 on "no"
- [ ] name: frontmatter field is always custom-{NAME} — matches filename exactly
- [ ] Written agent activates in /quick via: /quick <task> custom-{NAME}
- [ ] Agent and AskUserQuestion are not offered in Q5 tool selection
- [ ] blank template Q3 prompt asks for free-form role description, not specialization
</success_criteria>
````

- [ ] **Step 2: Install to ~/.claude/commands/**

```bash
cp commands/create-agent.md ~/.claude/commands/create-agent.md
echo "installed"
ls ~/.claude/commands/create-agent.md
```

- [ ] **Step 3: Final commit**

```bash
git add commands/create-agent.md
git commit -m "feat: complete /create-agent command with success criteria"
```

---

### Task 10: End-to-end smoke test

No automated tests exist for Claude Code commands — verification is manual. Run through two scenarios to confirm the command works as intended.

- [ ] **Step 1: Test happy path — domain-expert template**

In Claude Code, run:
```
/create-agent
```

Walk through:
- Q1: C (domain-expert)
- Q2: `payments-expert`
- Q3: "payments processing and PCI DSS compliance"
- Q4: A (direct)
- Q5: looks good (accept defaults: Read, Grep, Glob, Bash)

Confirm the preview shows a well-formed agent file with:
- `name: custom-payments-expert` in frontmatter
- `You are payments-expert —` in the role block (bare display name, no `custom-` prefix)
- 3-5 focus bullets relevant to payments/PCI
- Direct/blunt tone paragraph

Type "yes". Confirm:
```bash
cat ~/.claude/agents/custom-payments-expert.md
```
Expected: valid agent file with correct structure.

- [ ] **Step 2: Test overwrite guardrail**

Run `/create-agent` again:
- Q1: A (security-reviewer)
- Q2: `payments-expert`

Expected: immediate overwrite warning because `custom-payments-expert.md` already exists. Answer "no" → should return to Q2 and ask for a different name.

- [ ] **Step 3: Test /quick dispatch**

After creating the agent, run:
```
/quick check the checkout module for PCI compliance issues custom-payments-expert
```

Expected: dispatches `subagent_type: custom-payments-expert` directly (Path 3, no pre-flight).

- [ ] **Step 4: Test :mode warning**

Run:
```
/quick check something custom-payments-expert:review
```

Expected: warning `"Note: custom-payments-expert is a single-mode agent — :review suffix ignored."` then dispatches normally.

- [ ] **Step 5: Clean up test agent**

```bash
rm ~/.claude/agents/custom-payments-expert.md
echo "cleaned up"
```

---

### Task 11: Push all commits

- [ ] **Step 1: Review what will be pushed**

```bash
git log origin/main..HEAD --oneline
git diff origin/main --stat
```

Expected: 7-8 commits covering update.md skip filter, quick.md fallback, and create-agent.md in stages.

- [ ] **Step 2: Push**

```bash
gh auth switch --user Corye-CIC
git push origin main
```

- [ ] **Step 3: Update local ~/.claude/review-squad-version**

```bash
LATEST=$(curl -sf "https://api.github.com/repos/Corye-CIC/Review_Squad/commits/main" | python3 -c "import json,sys; print(json.load(sys.stdin)['sha'])")
printf '%s\n' "$LATEST" > ~/.claude/review-squad-version
echo "version updated to ${LATEST:0:7}"
```
