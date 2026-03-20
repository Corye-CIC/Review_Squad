---
name: implement
description: Run the Review Squad in implementation mode — parallel domain-specific coding guided by the Implementation Brief
argument-hint: "[optional: path to brief or task description]"
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
Execute parallel implementation using the squad. Each agent writes code in their domain following the Implementation Brief produced by `/consult`. Emily designs validation tests in parallel. PM Cory coordinates. Nando oversees integration.

The squad:
1. **FC** — Writes core business logic, models, utilities, type definitions
2. **Jared** — Writes auth, validation, DB queries, security hardening
3. **Stevey** — Writes frontend components, styles, interactions, accessibility (if frontend) + service clients, caching, circuit breakers, integration tests (always)
4. **Emily** — Designs validation tests in parallel (Playwright E2E if installed, automated + manual otherwise). Tests are ready for `/review`.
5. **PM Cory** — Coordinates agents, manages interfaces, tracks progress, persists learnings
6. **Nando** — Spot-checks quality, resolves conflicts, writes integration glue, final verification
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: loads the brief from `.review-squad/<project-name>/current-brief.md`
- Path to a brief file
- Task description (will run a quick inline consultation first)
</context>

<process>

## Step 1: Load the Implementation Brief and Emily's context

Check for existing brief and Emily's prior phase outputs:
```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
BRIEF_PATH="${SQUAD_DIR}/current-brief.md"
PLAN_PATH="${SQUAD_DIR}/current-plan.md"
DISCUSSION_PATH="${SQUAD_DIR}/current-discussion.md"
RESEARCH_PATH="${SQUAD_DIR}/current-research.md"
```

**If brief exists:** Read and use it.
**If $ARGUMENTS is a file path:** Read that file as the brief.
**If $ARGUMENTS is a task description and no brief exists:** Tell the user to run `/consult` first, or offer to run a quick inline consultation.

Also read Emily's plan if it exists — agents should be aware of the plan's accessibility requirements and success criteria so they can implement accordingly.

## Step 2: Parse the brief

Extract from the Implementation Brief:
- Wave structure (which agents work when)
- Per-agent scope (files and responsibilities)
- Shared interfaces (contracts between agents)
- Security requirements
- Quality gates

If Emily's plan exists, also extract:
- Accessibility requirements per phase
- UX validation points
- Success criteria

## Step 3: Execute Wave 1 (foundations)

Spawn agents assigned to Wave 1. These typically run sequentially because later waves depend on them.

Each agent prompt must include:
- Their specific scope from the brief
- The shared interfaces they need to define or implement
- The full Implementation Brief for context
- Emily's accessibility requirements relevant to their scope (if plan exists)
- Instruction to operate in **implement mode**
- Instruction to commit each logical unit atomically
- Working directory path

Spawn PM Cory alongside to coordinate and track.

## Step 4: Verify Wave 1, spawn Wave 2

After Wave 1 completes:
1. Read the files created by Wave 1 agents
2. Verify shared interfaces were defined correctly
3. If issues found, fix before proceeding

Spawn Wave 2 agents **in parallel** — they can work simultaneously now that foundations exist.

Also spawn Emily in **implement mode** in parallel with Wave 2. Emily designs validation tests while the implementation agents write production code. Emily's prompt must include:
- The full Implementation Brief
- Emily's plan (if it exists) — especially success criteria and accessibility requirements
- Wave 1 outputs (file paths and interfaces) so tests can reference real code
- The project's test infrastructure (Playwright installed? Jest/Vitest? Test directory conventions?)
- Instruction to operate in **implement mode** (validation design)

> **File assignment constraint:** Nando's Implementation Brief must guarantee that no two agents are assigned the same file within a single wave. If two agents need to modify the same file, either sequence them across waves or have one agent own the file with the other providing requirements. Emily writes to the test directory only — no conflict with implementation agents. PM Cory should verify this constraint before wave execution begins.

Each Wave 2 agent prompt must include:
- Their scope from the brief
- Wave 1 outputs they depend on (exact file paths and interface definitions)
- Instruction to consume the interfaces defined in Wave 1

## Step 5: Post-implementation integration check

After all waves complete, spawn Nando in **implement mode**:

```
Implementation complete. Here are the agent reports:

=== FC ===
{bbc_report}

=== JARED ===
{jared_report}

=== STEVEY ===
{stevey_report}

=== EMILY — Validation Test Plan ===
{emily_test_plan}

=== PM CORY ===
{pm_cory_coordination_report}

{If Emily's plan exists:}
=== EMILY'S PLAN (for reference) ===
{plan_content}

Spot-check the implementation against the brief.
Verify integration points work together.
Write any integration glue needed.
Check Emily's validation tests reference real files and interfaces from the implementation.
Report overall status.
If Emily's plan exists, note whether the implementation
addresses her accessibility requirements and success criteria.
```

## Step 6: Present results

Display the combined implementation report.

```
## Implementation Complete

{Summary of what was built by each agent}

### Validation Tests Ready
{Emily's test plan summary — test files created, coverage matrix, manual checklists}

### Integration Status
{Nando's integration check results}

### Files Created/Modified
{Combined file list — including test files}

Next: `/review` to run the full review squad on these changes (Emily will execute her validation tests)
```

</process>

<success_criteria>
- [ ] Implementation Brief loaded and parsed
- [ ] Emily's plan loaded for accessibility/UX context (if it exists)
- [ ] Wave 1 agents completed and interfaces verified
- [ ] Wave 2 agents completed in parallel
- [ ] Emily designed validation tests in parallel with Wave 2
- [ ] Emily's tests map to success criteria from the plan
- [ ] PM Cory tracked coordination and persisted learnings
- [ ] Nando verified integration across agents (including test coverage)
- [ ] All code committed atomically (implementation + test files)
- [ ] Results presented with next steps
</success_criteria>
