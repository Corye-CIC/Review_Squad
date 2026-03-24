# `/quick` Command Design

**Date:** 2026-03-24
**Status:** Draft

## Overview

A lightweight ad-hoc command that bypasses the full Review Squad lifecycle (`/discuss` → `/research` → `/plan` → `/consult` → `/implement` → `/review` → `/ship`) and runs selected agents directly on a short task description. Designed for quick, focused work without ceremony. Token-efficient by design — only the agents genuinely needed for a task are spawned.

---

## Syntax

```
/quick <task description> [agent1,agent2,...] [+nando]
/quick <task description> [agent:mode,agent:mode,...] [+nando]
```

To avoid ambiguity between task words and agent names, agent tokens and `+nando` must appear as the **last whitespace-separated segment(s)** of `$ARGUMENTS`. The command parses from right to left: strip any trailing `+nando`, then check whether the last remaining segment is a valid comma-separated agent list. Everything to the left of that segment is the task description. If the last segment is not a valid agent list, the entire string is the task description and Path 1 (PM Cory routing) applies.

A valid agent list segment consists of one or more comma-separated tokens each matching `[alias]` or `[alias]:[mode]` from the tables below, with no spaces inside the segment.

**Agent name aliases:**

| Short | Resolves to |
|---|---|
| `fc` | `father-christmas` |
| `jared` | `jared` |
| `stevey` | `stevey-boy-choi` |
| `cory` | `pm-cory` |
| `nando` | `nando` |
| `emily` | `emily` |

**Valid modes:** `implement`, `review`, `consult`, `audit`

**Validation errors** (hard stop with a clear message — do not proceed):
- Empty task description (e.g. `/quick fc,jared` with no preceding text): `"Task description is required."`
- Unknown agent alias (e.g. `carlos`): `"Unknown agent: carlos. Valid aliases: fc, jared, stevey, cory, nando, emily."`
- Invalid mode (e.g. `fc:ship`): `"Invalid mode 'ship' for fc. Valid modes: implement, review, consult, audit."`

---

## Execution Paths

### Path 1 — No agents specified (PM Cory routing)

PM Cory (`pm-cory-early`) receives the task description and:
1. Determines the **single most fitting agent** for the job — maximum two agents, and only if the task genuinely and clearly spans two separable domains (e.g. security hardening on a frontend component)
2. For each chosen agent, determines the appropriate mode
3. Fires immediately — no confirmation step

Domain routing heuristics for Cory:
- Security / auth / validation / hardening → `jared`
- Database / schema / business logic / models → `fc`
- Frontend / UX / accessibility / service connectivity → `stevey`
- Unclear / multi-domain → pick the dominant concern; escalate to two only when both domains require distinct, non-overlapping work

`pm-cory-early` is the existing early-phase PM Cory agent defined in `~/.claude/agents/pm-cory-early.md`.

### Path 2 — Agents specified, no modes (self-select pre-flight)

Maximum 4 agents per `/quick` call. If more than 4 are specified, the command errors: `"Too many agents for /quick (max 4). Use /implement for full-squad work."`

Steps:

1. Spawn each named agent in parallel with a lightweight pre-flight prompt:
   ```
   Task: {task_description}
   Reply in this exact format — no other text:
   MODE: [implement|review|consult|audit]
   RELEVANCE: [high|medium|low]
   REASON: [one line — what you would specifically do]
   ```

2. Collect all responses.

3. Filter: keep only `high` relevance agents. Drop `medium` and `low`.

4. **All-low edge case:** if the filtered set is empty (all agents returned `medium` or `low`), show the results for all named agents in user-specified order, pipe-separated on one line (scales to any agent count):
   ```
   No agents rated this task as high relevance.
   Results: FC: low | Jared: medium | Stevey: low
   Options: (p)roceed with highest-rated agent, (e)dit agent list, (a)bort
   ```
   On `p`: pick the single agent with the highest relevance rating (prefer `medium` over `low`). If multiple agents share the top rating, pick the first one in user-specified order. Spawn that agent directly — no step-5 confirmation.
   On `e`: see edit flow below. On `a`: abort silently.

5. Show the user a confirmation summary of the **kept agents only** before spawning actual work:
   ```
   FC: implement — will fix the validation logic
   Proceed? (y/n/edit)
   ```
   Dropped agents are not shown in the confirmation. They are silently excluded.

6. On `y`: spawn approved agents with their self-selected modes.

7. On `n`: abort.

8. On `edit`: prompt the user:
   ```
   Enter revised agent list (e.g. fc:implement,jared:review):
   ```
   Parse the user's input as an explicit `agent:mode` list. Validate each token. Fire immediately with the revised list — no further pre-flight. If the user's input is invalid, show the relevant validation error and re-prompt once; if still invalid, display `"Aborting."` and stop.

### Path 3 — Agents with explicit modes

User has specified exactly what they want. Validate all agent names and modes, then fire immediately — no pre-flight, no confirmation.

If `nando` appears with an explicit mode in the agent list (e.g. `fc:implement,nando:review`) **and** `+nando` is also present, the explicit mode takes precedence — Nando runs in the user-specified mode as a peer agent, and the `+nando` synthesis pass is skipped. Path 3's contract is "fire exactly what the user specified."

---

## +nando Flag and nando as Agent

When `+nando` is present, after all primary agents complete:
- Spawn `nando-review` with all agent outputs concatenated
- Nando delivers a consolidated verdict

If `nando` appears in the **agent list** (Path 2, no explicit mode) and `+nando` is also present, treat them as equivalent — Nando runs once as a synthesiser after the other agents complete (using `nando-review`). `nando` in the agent list without `+nando` triggers the pre-flight self-select for Nando; the resulting agent file used is `nando-{self-selected-mode}.md` (e.g. `nando-consult` if Nando self-selects consult mode). This is valid but unusual — Nando runs as a peer agent, not as a synthesiser.

`+nando` is omitted by default to keep runs fast and token-light.

---

## Output Format

Outputs are displayed in **user-specified agent order** (the order agents were listed in the command), not completion order. For Path 1 (PM Cory routing), outputs are displayed in the order Cory chose them — primary agent first, secondary agent second if two were spawned. Each agent's section is preceded by a header:

```
=== FC (implement) ===
{fc output}

=== JARED (review) ===
{jared output}
```

If `+nando`:
```
=== NANDO (synthesis) ===
{nando verdict}
```

---

## Token Efficiency Rules

- PM Cory picks **one agent by default**, two only when domains are clearly separable
- Self-select pre-flight queries are lightweight — one structured reply per agent, no actual work
- Pre-flight cost is proportional to the number of agents named; maximum 4 agents caps the worst case at 4 pre-flight spawns
- Only `high` relevance agents proceed to full execution
- No Nando unless explicitly requested
- No Cory coordination layer during execution (unlike `/implement`)
- No persistent memory updates — PM Cory in this command does not write to `learnings.jsonl`

---

## Emily as Agent

Emily is a valid agent in `/quick`. She can be invoked with any mode (e.g. `emily:implement` to write validation tests for the task). She has no automatic role in this command — she is not invoked unless explicitly named.

---

## Examples

```bash
# PM Cory routes — picks single best agent, fires immediately
/quick fix the null pointer in auth middleware

# Two agents, self-select modes — pre-flight + confirmation
/quick add rate limiting to the WebSocket handler fc,jared

# Explicit modes — fires immediately, no confirmation
/quick review the new caching layer fc:review,jared:review

# Self-select + Nando synthesis
/quick refactor the session manager stevey,fc +nando

# Explicit + Nando
/quick fix the broken CI pipeline jared:implement +nando
```

---

## Files to Create

- `commands/quick.md` — the command file
- No new agent files required — uses existing mode-suffixed agents

---

## Out of Scope

- No persistent memory updates (PM Cory does not write to `learnings.jsonl` in this command)
- No `.review-squad/` artifacts written
- No plan adherence checks (no plan exists for ad-hoc tasks)
- No automatic Emily validation tests (Emily is available but must be explicitly named)
