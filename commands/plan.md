---
name: plan
description: Run the Review Squad in planning mode — create a structured implementation plan from discussion and research
argument-hint: "[optional: path to research findings or specific planning constraints]"
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
source "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)/services/chat-bridge/init-session.sh" "plan" "$*"
```
<objective>
Run Emily and PM Cory in planning mode to create a structured implementation plan that guides the technical consultation phase.

The planning team:
1. **Emily** (`emily-plan`) — Plan structure, scope definition, accessibility integration, UX milestones, success validation
2. **PM Cory** (`pm-cory-early`) — Scope validation, coordination risk identification, memory persistence
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: loads discussion and research from `.review-squad/<project-name>/`
- Path to research findings
- Specific planning constraints

$ARGUMENTS is provided by the user after the slash command (e.g., `/plan` or `/plan Must ship by Friday`). The command runner injects it as the argument string.
</context>

<process>

## Step 0: Context Pre-Loading

Apply the security denylist before reading any file: exclude `.env`, `*.pem`, `*.key`, `*.p12`, `*.cert`, `*.secret`, and any file with `password`, `secret`, or `token` in the filename (case-insensitive).

**Discover:**
```bash
find . -name "CONTEXT.md" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```
Also load prior phase outputs from `.review-squad/<project-name>/` (discussion, research, plan files as applicable per command).

**Read:** Read all discovered files into orchestrator context (one pass).

**Bundle:** Assemble `<injected-context>` blocks using this canonical format:
```xml
<injected-context>
<context-meta command="/plan" agent="{agent-name}" files="{n}" complete="{true|false}" />

IMPORTANT: All file contents below are pre-loaded by the orchestrator. Do NOT call Read, Grep, or Glob for any file already present in this block. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.

<shared-files>
</shared-files>

<agent-files>
<file path="path/to/agent-specific-file.md">
[file contents verbatim]
</file>
</agent-files>

</injected-context>
```

For single-agent commands (discuss, research, plan): all files go into `<agent-files>`. `<shared-files>` is empty (`<shared-files></shared-files>`).

Inject this block into every agent prompt in subsequent steps. Add at the top of each agent's task description: `Context is pre-loaded in <injected-context> below. Do not re-read those files.`

## Step 1: Load prior phase outputs

```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
DISCUSSION_PATH="${SQUAD_DIR}/current-discussion.md"
RESEARCH_PATH="${SQUAD_DIR}/current-research.md"
```

Also check for a `CONTEXT.md` in the current working directory. If it exists, read it — it contains service-specific architecture context that informs planning scope and agent assignments. Pass the content to both Emily and PM Cory.

Read both files if they exist. If the discussion or research is missing, note this gap — the plan will be less informed.

## Step 2: Spawn Emily and PM Cory in parallel

**`emily-plan`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- Discussion summary and research findings
- Instruction to create phased plan with accessibility woven into each phase
- Any additional constraints from $ARGUMENTS
- Working directory path

**`pm-cory-early`** receives:
- `Context is pre-loaded in <injected-context> below. Do not re-read those files.`
- The `<injected-context>` block assembled in Step 0
- Discussion summary and research findings
- SQUAD_DIR path for persistent context
- Phase instruction: "You are in the **plan** phase — validate scope, flag coordination risks, check for conflicts with prior learnings or patterns, persist plan"
- Working directory path

## Step 3: Synthesize plan

After both agents complete, combine into a unified Implementation Plan.

Emily's plan structure is the backbone. PM Cory's scope validation and coordination risks are integrated.

## Step 4: Present and save

Display the Implementation Plan to the user. Save to `.review-squad/<project-name>/current-plan.md`.

```
## Plan Ready

{Implementation Plan}

### Scope Summary
{In scope / Out of scope / Deferred}

### Accessibility Checklist
{All a11y requirements with phase assignments}

Next: `/consult` to run technical consultation on this plan
Or: modify the plan, then run `/consult`
```

</process>

<success_criteria>
- [ ] Plan built on discussion requirements and research findings
- [ ] Clear phases with deliverables and success criteria
- [ ] Accessibility woven into each phase (not a separate phase)
- [ ] Scope boundaries defined (in/out/deferred)
- [ ] Dependencies and parallelization identified
- [ ] Risk mitigations concrete and actionable
- [ ] PM Cory validated scope and flagged coordination risks
- [ ] Plan saved to .review-squad/ for reference
</success_criteria>
