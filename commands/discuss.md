---
name: discuss
description: Run the Review Squad in discussion mode — explore the problem space before any technical work
argument-hint: "<description of what to build or problem to solve>"
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
Run Emily and PM Cory in discussion mode to explore the problem space, gather requirements, define success criteria, and identify open questions for research.

The discussion team:
1. **Emily** (lead) — Problem framing, requirements gathering, success criteria, accessibility requirements, UX vision
2. **PM Cory** (co-lead) — Prior learnings, fresh perspective challenges, memory retention
</objective>

<context>
$ARGUMENTS — Description of what to build or the problem to solve. Can be:
- Freeform text: "Add user authentication with OAuth"
- File reference: "implement the changes described in docs/spec.md"
- Task reference: "the feature from issue #42"

$ARGUMENTS is provided by the user after the slash command (e.g., `/discuss Add user auth`). The command runner injects it as the argument string.
</context>

<process>

## Step 1: Gather initial context

Read relevant files to understand the current state:
- Project structure (key directories, entry points)
- README or documentation for project goals
- Existing feature patterns

## Step 2: Load PM Cory's persistent context

```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
mkdir -p "${SQUAD_DIR}/agent-notes"
```

## Step 3: Spawn Emily and PM Cory in parallel

Spawn both agents using the Agent tool:

**Emily** receives:
- The task description ($ARGUMENTS)
- Project context gathered in Step 1
- Instruction to operate in **discuss mode**
- Instruction to define requirements, success criteria, and accessibility needs
- Working directory path

**PM Cory** receives:
- The task description ($ARGUMENTS)
- SQUAD_DIR path for loading persistent context
- Instruction to operate in **discuss mode** — surface prior learnings, challenge assumptions, bounce ideas with Emily
- Working directory path

## Step 4: Synthesize discussion

After both agents complete, combine their outputs into a unified Discussion Summary.

Emily's output is the primary structure. PM Cory's contributions are woven in where they add value.

## Step 5: Present and save

Display the Discussion Summary to the user. Save to `.review-squad/<project-name>/current-discussion.md`.

```
## Discussion Complete

{Discussion Summary}

### Open Questions for Research
{questions that need investigation}

Next: `/research` to investigate open questions
Or: modify the discussion summary, then run `/research`
```

</process>

<success_criteria>
- [ ] Problem clearly framed
- [ ] Requirements gathered (must have / should have / nice to have)
- [ ] Success criteria defined with measurable outcomes
- [ ] Accessibility requirements identified
- [ ] UX vision articulated
- [ ] Open questions listed for research phase
- [ ] PM Cory surfaced relevant prior learnings
- [ ] Discussion saved to .review-squad/ for reference
</success_criteria>
