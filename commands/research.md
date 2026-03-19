---
name: research
description: Run the Review Squad in research mode — investigate patterns, technology options, and prior art
argument-hint: "[optional: specific questions to research or path to discussion summary]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
---
<objective>
Run Emily and PM Cory in research mode to investigate open questions from the discussion phase, evaluate technology options, analyze codebase patterns, and identify risks.

The research team:
1. **Emily** (lead) — Technology evaluation, prior art, accessibility patterns, risk identification, recommendation synthesis
2. **PM Cory** (co-lead) — Codebase exploration, existing pattern surfacing, prior session memory
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: loads discussion from `.review-squad/<project-name>/current-discussion.md`
- Specific questions to research
- Path to a discussion summary file

$ARGUMENTS is provided by the user after the slash command (e.g., `/research` or `/research What auth libraries work with our stack?`). The command runner injects it as the argument string.
</context>

<process>

## Step 1: Load discussion context

Check for existing discussion:
```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
DISCUSSION_PATH="${SQUAD_DIR}/current-discussion.md"
```

**If discussion exists:** Read and use its open questions as the research agenda.
**If $ARGUMENTS provided:** Use as the research focus.
**If neither:** Tell the user to run `/discuss` first or provide research questions.

## Step 2: Spawn Emily and PM Cory in parallel

**Emily** receives:
- The discussion summary (or research questions)
- Instruction to operate in **research mode**
- Instruction to evaluate technology options, research accessibility patterns, identify risks
- Working directory path

**PM Cory** receives:
- The discussion summary (or research questions)
- SQUAD_DIR path for persistent context
- Instruction to operate in **research mode** — explore codebase for existing patterns, surface prior approach memories
- Instruction to grep/read relevant source files to find existing patterns
- Working directory path

## Step 3: Synthesize research

After both agents complete, combine outputs into unified Research Findings.

Emily's analysis and recommendations are the primary structure. PM Cory's codebase findings and memories are integrated throughout.

## Step 4: Present and save

Display Research Findings to the user. Save to `.review-squad/<project-name>/current-research.md`.

```
## Research Complete

{Research Findings}

### Recommendation
{Emily's recommended approach}

Next: `/plan` to create the implementation plan
Or: modify the research, then run `/plan`
```

</process>

<success_criteria>
- [ ] Open questions from discussion answered
- [ ] Codebase patterns analyzed by PM Cory
- [ ] Technology options evaluated with pros/cons
- [ ] Accessibility patterns researched
- [ ] Risks identified with likelihood and impact
- [ ] Clear recommendation made with rationale
- [ ] Research saved to .review-squad/ for reference
</success_criteria>
