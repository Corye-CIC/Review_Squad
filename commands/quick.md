---
name: quick
description: Run one or more Review Squad agents directly on a short task — no full lifecycle required
argument-hint: "<task description> [fc,jared,...] [fc:implement,...] [+nando]"
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
source "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)/services/chat-bridge/init-session.sh" "quick" "$*"
```
<objective>
Run one or more Review Squad agents directly on a short task description, bypassing the full `/discuss` → `/research` → `/plan` → `/consult` → `/implement` → `/review` → `/ship` lifecycle. Token-efficient: only the agents genuinely needed are spawned.

Three execution paths depending on how agents are specified:
1. **No agents** — domain heuristics route to the single best-fit agent automatically
2. **Agents without modes** — agents self-select their mode via a lightweight pre-flight; user confirms before work begins
3. **Agents with explicit modes** — fires immediately, no confirmation
</objective>

<context>
$ARGUMENTS format: `<task description> [agent-list] [+nando]`

Agent aliases: `fc` (father-christmas), `jared`, `stevey` (stevey-boy-choi), `cory` (pm-cory), `nando`, `emily`
Valid modes: `implement`, `review`, `consult`, `audit` (emily uses a different set — see parsing section)
</context>

<parsing>

## Argument Parsing

Parse `$ARGUMENTS` right-to-left:

1. Strip trailing `+nando` if present. Set `HAS_NANDO=true`.
2. Check whether the last whitespace-separated segment is a valid agent list — one or more comma-separated tokens each matching `[alias]` or `[alias]:[mode]` with no spaces inside the segment.
3. If it is a valid agent list: that segment is `AGENT_LIST`; everything to its left is `TASK`.
4. If it is not a valid agent list: entire `$ARGUMENTS` (minus `+nando`) is `TASK`; `AGENT_LIST` is empty → Path 1.

**Validation — hard stop with message if any rule is violated:**

- `TASK` is empty → `"Task description is required."`
- Unknown alias in `AGENT_LIST` (e.g. `carlos`) → `"Unknown agent: carlos. Valid aliases: fc, jared, stevey, cory, nando, emily."`
- `emily` without explicit mode in `AGENT_LIST` → `"emily requires an explicit mode in /quick. Valid modes: implement, review, discuss, research, plan, present."`
- Invalid mode for `emily` (e.g. `emily:consult`) → `"Invalid mode 'consult' for emily. Valid modes: implement, review, discuss, research, plan, present."`
- Invalid mode for other agents (e.g. `fc:ship`) → `"Invalid mode 'ship' for fc. Valid modes: implement, review, consult, audit."`
- More than 4 agents in `AGENT_LIST` (Path 2 only) → `"Too many agents for /quick (max 4). Use /implement for full-squad work."`

**Resolve aliases to full names:**
- `fc` → `father-christmas`
- `stevey` → `stevey-boy-choi`
- `cory` → `pm-cory`
- All others (`jared`, `nando`, `emily`) → unchanged

**Determine execution path:**
- `AGENT_LIST` empty → **Path 1**
- `AGENT_LIST` has agents, none have `:mode` suffix → **Path 2**
- All agents in `AGENT_LIST` have `:mode` suffix → **Path 3**
- Mixed (some with mode, some without) → `"Mixed agent list not supported: either all agents must have explicit modes or none. Use fc:implement,jared or fc,jared — not both."`

</parsing>

<process>

## Path 1 — Direct Routing (no agents specified)

Apply domain heuristics to determine the single best-fit agent and mode:

- security / auth / validation / hardening → `jared`
- database / schema / business logic / models → `father-christmas`
- frontend / UX / accessibility / service connectivity → `stevey-boy-choi`
- When unclear, pick the dominant concern.

Pick ONE agent. Only escalate to TWO if the task genuinely spans two clearly separable domains (e.g. security hardening on a frontend component). Maximum two agents.

Determine mode from task description: `implement` (build/add/fix), `review` (inspect/check/audit), `consult` (design/plan), `audit` (deep audit).

Spawn the chosen agent(s) using the Agent tool (subagent_type: `{agent-name}-{mode}`). Each agent's prompt:

```
Task: {TASK}

Working directory: {cwd}
```

After agents complete, display outputs using the format:
```
=== {AGENT NAME} ({mode}) ===
{output}
```

If `HAS_NANDO=true`, after the primary agents complete, proceed to the **+nando synthesis** section.

## Path 2 — Self-Select Pre-Flight (agents without explicit modes)

### Step 1: Pre-flight

Spawn each agent in `AGENT_LIST` in parallel using the Agent tool. Use subagent_type: `{agent-name}-consult` for the pre-flight (lightest available mode). Prompt each agent:

```
Task: {TASK}

Working directory: {cwd}

Reply in this exact format — no other text:
MODE: [implement|review|consult|audit]
RELEVANCE: [high|medium|low]
REASON: [one line — what you would specifically do for this task]
```

Collect all responses.

### Step 2: Filter

Keep only agents that returned `RELEVANCE: high`. Drop medium and low silently.

**All-low edge case** — if no agents returned high:

Display (pipe-separated, all agents in user-specified order):
```
No agents rated this task as high relevance.
Results: {AGENT1}: {relevance} | {AGENT2}: {relevance} | ...
Options: (p)roceed with highest-rated agent, (e)dit agent list, (a)bort
```

Use `AskUserQuestion` to capture the user's choice.

- `p` → pick the agent with the highest relevance (prefer medium over low; ties broken by user-specified order). Spawn directly — skip the step-3 confirmation.
- `e` → go to the edit flow (Step 4 below).
- `a` → stop silently.

### Step 3: Confirm kept agents

Use `AskUserQuestion` to show only the kept (high-relevance) agents and ask for confirmation:

```
{AGENT1}: {self-selected mode} — {reason}
{AGENT2}: {self-selected mode} — {reason}
Proceed? (y/n/edit)
```

- `y` → spawn each kept agent with their self-selected mode using the Agent tool (subagent_type: `{agent-name}-{mode}`). Each agent's prompt:

```
Task: {TASK}

Working directory: {cwd}
```
- `n` → stop silently.
- `edit` → go to the edit flow.

### Step 4: Edit flow

Use `AskUserQuestion` to prompt:
```
Enter revised agent list (e.g. fc:implement,jared:review):
```

Parse and validate the user's input as an explicit `agent:mode` list. If valid, fire immediately (Path 3 logic). If invalid, show the validation error and re-prompt once. If still invalid, display `"Aborting."` and stop.

**Special case — `nando` in agent list + `HAS_NANDO=true`:**
If `nando` appears in `AGENT_LIST` (Path 2, no explicit mode) and `HAS_NANDO=true`, treat as equivalent — skip the Nando pre-flight entirely and run Nando once as synthesiser (`nando-review`) after the other agents complete. Do not spawn Nando in the pre-flight step.

If `nando` appears in `AGENT_LIST` without `HAS_NANDO`, it goes through the normal pre-flight and runs as a peer agent in its self-selected mode (subagent_type: `nando-{self-selected-mode}`).

If `HAS_NANDO=true` (and nando not in AGENT_LIST), after primary agents complete, proceed to **+nando synthesis**.

---

## Path 3 — Explicit Modes (agents with :mode specified)

Validate all agent names and modes. If `nando` has an explicit mode and `+nando` is also present, the explicit mode takes precedence — Nando runs as a peer agent in its specified mode, and the `+nando` synthesis pass is skipped.

Spawn all agents in parallel using the Agent tool (subagent_type: `{agent-name}-{mode}`). Each agent's prompt:

```
Task: {TASK}

Working directory: {cwd}
```

No confirmation step.

If `HAS_NANDO=true` (and Nando was not explicitly listed with a mode), proceed to **+nando synthesis** after agents complete.

---

## +nando Synthesis

Spawn `nando-review` with all primary agent outputs concatenated:

```
Task:
---
{TASK}
---

Working directory: {cwd}

Here are the outputs from your squad:

{for each agent:}
=== {AGENT NAME} ({mode}) ===
{agent output}

Synthesize these outputs into a consolidated verdict. Focus on the task above — flag conflicts, highlight key findings, provide clear next steps.
```

---

## Output Format

Display agent outputs in user-specified order (or routing-determined order for Path 1 — primary first, secondary second). Each section preceded by a header:

```
=== {AGENT NAME} ({mode}) ===
{agent output}
```

If +nando:
```
=== NANDO (synthesis) ===
{nando verdict}
```

</process>

<success_criteria>
- [ ] Path 1: domain heuristics route to single best-fit agent without confirmation
- [ ] Path 2: Pre-flight fires in parallel; only high-relevance agents proceed; user confirms before work
- [ ] Path 2 all-low: user prompted with p/e/a options; p picks first highest-rated agent
- [ ] Path 3: agents fire immediately with no pre-flight or confirmation
- [ ] +nando: Nando synthesis runs after primary agents complete
- [ ] Validation errors halt execution with clear messages
- [ ] Output displayed in user-specified order with === AGENT (mode) === headers
- [ ] No .review-squad/ artifacts written; no learnings.jsonl updates
</success_criteria>
