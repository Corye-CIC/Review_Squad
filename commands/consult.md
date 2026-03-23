---
name: consult
description: Run the Review Squad in consultation mode — design the approach before writing code
argument-hint: "<description of what to build>"
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
source "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)/services/chat-bridge/init-session.sh" "consult" "$*"
```
<objective>
Run the squad in consultation mode before implementation begins. Each agent analyzes the task from their specialty, then Nando synthesizes an Implementation Brief that guides parallel implementation. If Emily's plan exists from a prior `/plan` run, it serves as the input for consultation.

The squad: `father-christmas-consult`, `jared-consult`, `stevey-boy-choi-consult`, `pm-cory-consult` (parallel) → `nando-consult` (synthesis).

> **Recommended flow:** `/discuss` → `/research` → `/plan` → `/consult` → `/implement` → `/review`
> You can skip directly to `/consult` for smaller tasks, but the full flow produces better outcomes.
</objective>

<context>
$ARGUMENTS — Description of what to build. Can be:
- Freeform text: "Add user authentication with OAuth"
- File reference: "implement the changes described in docs/spec.md"
- Task reference: "the feature from issue #42"
- Empty: if Emily's plan exists at `.review-squad/<project-name>/current-plan.md`, use that as input

$ARGUMENTS is provided by the user after the slash command (e.g., `/consult Add user auth`). The command runner injects it as the argument string.
</context>

<process>

## Step 1: Gather context

**Check for CONTEXT.md files first** — these are pre-written service summaries that replace broad exploration:
```bash
find . -name "CONTEXT.md" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```
If found, read them. Pass their content directly to consultation agents instead of having agents glob/read widely. CONTEXT.md files contain: architecture overview, file list, key state, protocols, and constraints.

If no CONTEXT.md exists, read relevant files to understand the current codebase state:
- Project structure (key directories, entry points)
- Existing patterns (how similar features are currently implemented)
- Database schema if relevant
- Frontend component structure if relevant

Also check for Emily's prior phase outputs:
```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
PLAN_PATH="${SQUAD_DIR}/current-plan.md"
DISCUSSION_PATH="${SQUAD_DIR}/current-discussion.md"
RESEARCH_PATH="${SQUAD_DIR}/current-research.md"
```

If `current-plan.md` exists, read it — this is Emily's implementation plan and should serve as the primary input for consultation. Also read discussion and research files if present for full context.

## Step 2: Load PM Cory's persistent context

```bash
mkdir -p "${SQUAD_DIR}/agent-notes"
```

## Step 3: Spawn consultation agents in parallel

Spawn `father-christmas-consult`, `jared-consult`, `stevey-boy-choi-consult`, `pm-cory-consult` in parallel using the Agent tool. Stevey always participates (connectivity hat always on; frontend hat activates when frontend is in scope).

Each agent prompt must include:
- The task description ($ARGUMENTS) — or Emily's plan if it exists
- If Emily's plan exists, include it verbatim and instruct agents to consult against the plan's requirements, accessibility checklist, and scope boundaries
- CONTEXT.md content (if found in Step 1) — passed verbatim so agents don't need to re-read service files
- Relevant codebase context (file structure, existing patterns) — only if CONTEXT.md not available
- Working directory path
- A `<file-scope>` block listing the files each agent should focus on (derived from CONTEXT.md file lists or grep/glob pre-resolution):

```
<file-scope>
Read and modify ONLY these files:
- [list of files relevant to this agent's domain]
Do not glob, grep, or explore outside this list. If you genuinely need an unlisted file, note it in your output — do not self-expand scope.
</file-scope>
```

For `pm-cory-consult`, include the SQUAD_DIR path for loading persistent context.

## Step 4: Spawn Nando

After all consultation agents complete, spawn `nando-consult` with all their briefs:

```
You are consulting on: $ARGUMENTS

{If Emily's plan exists:}
Emily's Implementation Plan (from /discuss → /research → /plan):
{plan_content}

Emily's Research Findings:
{research_content (if available)}

Here are the consultation briefs from your squad:

=== FC — Architecture Brief ===
{bbc_output}

=== JARED — Systems & Security Brief ===
{jared_output}

=== STEVEY — Design & Connectivity Brief ===
{stevey_output}

=== PM CORY — Consultation Notes ===
{pm_cory_output}

Produce the Implementation Brief. Resolve any conflicts between agents.
Lock down shared interfaces. Define the implementation waves.
If Emily's plan exists, ensure the brief aligns with her requirements,
accessibility checklist, and scope boundaries. Note any deviations.
```

## Step 5: Present the Implementation Brief

Display Nando's Implementation Brief to the user.

Save a copy to `.review-squad/<project-name>/current-brief.md` for reference during implementation.

```
## Implementation Brief Ready

{Nando's brief}

Next: `/implement` to execute this brief with the squad
Or: modify the brief and then run `/implement`
```

</process>

<success_criteria>
- [ ] Emily's prior phase outputs loaded if they exist
- [ ] Codebase context gathered
- [ ] All consultation agents completed their briefs
- [ ] Nando produced a unified Implementation Brief
- [ ] Brief aligns with Emily's plan (if it exists)
- [ ] Shared interfaces defined with exact signatures
- [ ] Scope divided cleanly between agents
- [ ] Implementation waves defined
- [ ] Brief saved to .review-squad/ for reference
</success_criteria>
