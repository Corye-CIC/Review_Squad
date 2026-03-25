# Design Spec: `/create-agent` Command

**Date:** 2026-03-25
**Status:** Approved — v2 (post spec review)
**Author:** Brainstorming session

---

## Overview

A `/create-agent` slash command that guides users through creating a custom Claude Code agent via sequential Q&A. Distributed as part of the Review Squad via `/update`. Outputs a `custom-{name}.md` agent file to `~/.claude/agents/`.

---

## Goals

- Let end users (e.g. Zach) create useful, well-structured agents without knowing the agent file format
- Template-first UX — users pick a starting point, customise what matters, get a working agent fast
- Custom agents are local-only, never overwritten by `/update`, never synced to GitHub

---

## Non-Goals

- No browser UI, no external tooling — pure Claude Code conversational interaction
- No multi-mode agents (no consult/implement/review modes) — single-purpose agents only
- No project-context auto-detection — user provides all specifics via Q&A

---

## Command Structure

**File:** `commands/create-agent.md`
**Invocation:** `/create-agent` (no arguments)
**Distribution:** shipped via `/update` alongside all other squad commands

**Output:** `~/.claude/agents/custom-{name}.md`

The `custom-` prefix convention:
- Visually distinguishes user-created agents from squad agents
- Makes the `/update` safety guarantee unconditional (see Update Safety below)
- Users reference custom agents in `/quick` via the bare name: `/quick <task> custom-{name}` (see Dispatch below)

---

## Update Safety

The `/update` command's incremental path (compare API) only downloads files present in the GitHub repo — custom agents are never in the repo and are therefore never touched.

The first-run path (contents API) enumerates `agents/*.md` from the repo. To make the safety guarantee unconditional, the `/update` command **must skip any file whose destination filename starts with `custom-`** during both first-run and incremental syncs. This filter must be added to the `/update` implementation alongside this feature.

> **Implementation note:** Add to `/update` Step 4: skip any file in `FILES_TO_SYNC` where `basename` starts with `custom-`.

---

## Dispatch via `/quick`

Custom agents are single-file, single-mode agents. They use `subagent_type: custom-{name}` (no mode suffix). The `/quick` command's current alias table is fixed (`fc`, `jared`, `stevey`, `cory`, `nando`, `emily`) and does not support arbitrary names.

**Required `/quick` extension (implemented alongside this feature):**

The custom agent fallback lookup runs **before** `/quick`'s mode validation step. This ordering is required because mode validation rejects unknown suffixes (e.g. `custom-payments-expert:anything`) before alias resolution even runs, which would prevent the fallback from firing at all.

**Lookup order in `/quick`:**
1. Check if the token (stripping any `:mode` suffix) matches `~/.claude/agents/custom-{token}.md`
2. If yes → Path 3 direct dispatch as `subagent_type: custom-{token}`, no mode suffix. If the user included a `:mode` suffix, emit a warning and discard it: `"Note: custom-{token} is a single-mode agent — :{mode} suffix ignored."`
3. If no → continue to existing alias table lookup and mode validation as normal

Custom agents must never enter Path 2 (pre-flight) — there is no `-consult` variant to spawn.

This makes custom agents first-class citizens in `/quick` without changing the alias model for squad agents.

**Example invocation after creation:**
```
/quick review the payments module for PCI compliance custom-payments-expert
```

---

## Templates

Six templates. Each pre-fills role framing, personality defaults, and tool list.

| Template | Pre-filled focus | Default tools |
|----------|-----------------|---------------|
| `security-reviewer` | Auth, injection, secrets, input validation | Read, Grep, Glob |
| `code-quality-reviewer` | Naming, structure, DRY, patterns, readability | Read, Grep, Glob |
| `domain-expert` | Business logic correctness for a specific domain | Read, Grep, Glob, Bash |
| `documentation-reviewer` | Accuracy, completeness, comment rot, stale docs | Read, Grep, Glob |
| `performance-reviewer` | N+1 queries, memory, redundant calls, hot paths | Read, Grep, Glob, Bash |
| `blank` | Nothing pre-filled — power user answers all questions freely | Read, Grep, Glob |

`domain-expert` is the most flexible — Q3 (specialization) is where the user injects their domain ("payments processing", "HIPAA compliance", "Kubernetes infrastructure") and the role wraps it with appropriate framing.

`blank` still asks all 5 questions — only the pre-population differs. Q3 for `blank` reads: "Describe this agent's role and what it should focus on."

Available tools for Q5: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`. `Agent` and `AskUserQuestion` are intentionally excluded — custom agents are leaf-node reviewers, not orchestrators.

---

## Q&A Flow

Five questions in order. Multiple choice where possible.

### Q1 — Template
> Which type of agent do you want to create?
> A) Security reviewer
> B) Code quality reviewer
> C) Domain expert
> D) Documentation reviewer
> E) Performance reviewer
> F) Blank (start from scratch)

### Q2 — Name
> What should this agent be called? This becomes part of the filename (`custom-{name}.md`) and how you reference it in `/quick`.
> Keep it short and lowercase with hyphens — e.g. `payments-expert`, `api-contracts`, `hipaa-reviewer`.

**Validation:**
- Enforce lowercase, hyphens only, no spaces, no special characters
- Check whether `~/.claude/agents/custom-{name}.md` already exists → trigger overwrite warning immediately (see below)

### Q3 — Specialization
> What should this agent focus on specifically?
> *(One or two sentences. E.g. for domain-expert: "payments processing and PCI compliance". For security-reviewer: "OAuth flows and JWT validation".)*

For `blank`: "Describe this agent's role and what it should focus on."

### Q4 — Personality tone
> Pick a tone:
> A) Direct and blunt — gets to the point, no sugarcoating (like Jared)
> B) Collaborative and warm — constructive, encouraging, explains reasoning
> C) Formal and precise — measured, thorough, technical language
> D) Neutral — no strong personality, just findings

### Q5 — Tools
> The template suggests these tools: `{pre-filled list based on template}`. Add or remove any?
> *(Most users can just say "looks good" here.)*

Valid tools: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`. If the user requests an invalid tool name, prompt them with the valid list.

---

## Preview & Write

After Q5, Claude generates the full agent file content and presents a preview:

```
Here's your agent — does this look right?

─────────────────────────────────────────
Agent: custom-payments-expert
File:  ~/.claude/agents/custom-payments-expert.md
─────────────────────────────────────────
[full agent file content shown verbatim]
─────────────────────────────────────────

Type "yes" to write the file, or tell me what to change.
```

**On confirmation:** write the file and print:
```
✓ Agent written to ~/.claude/agents/custom-payments-expert.md
Restart Claude Code or start a new session to activate it.
Use it with: /quick <task> custom-payments-expert
```

**On change request:** user describes the change in free text. Claude regenerates and shows the preview again. On each regeneration, structural constraints are re-enforced: frontmatter must be valid, tools must be from the allowed list, `name:` must remain `custom-{name}`. Content changes (tone, focus, wording) are applied freely.

**Overwrite guardrail:** if `custom-{name}.md` already exists (caught at Q2 or here):
```
⚠️  ~/.claude/agents/custom-payments-expert.md already exists. Overwrite? (yes/no)
```
If no, return to Q2.

---

## Generated Agent File Structure

Two name values are used throughout generation:
- **Identifier** (`custom-{name}`) — used in the filename and `name:` frontmatter field only
- **Display name** (`{name}`) — used in prose, the `<role>` block, and the confirmation message

```markdown
---
name: custom-{name}
description: {one-line description derived from template + specialization}
tools: {tool list from Q5}
---

<role>
You are {name} — {personality-framed role description based on template + Q3 specialization}.

{personality tone paragraph based on Q4 selection}
</role>

<focus>
{3-5 bullet points derived from template + specialization — what this agent checks for}
</focus>

<rules>
- Only review files within your specialization — flag anything outside your domain as out of scope
- Be specific: point to exact file and line number when flagging issues
- {tone-appropriate communication rule}
</rules>
```

**`name:` field:** always `custom-{name}` — matches the filename exactly. This is what Claude Code uses to resolve `subagent_type: custom-{name}`.

---

## Distribution & Update Behavior

- `commands/create-agent.md` is tracked by `/update` and synced like any other command
- Generated `custom-*.md` files in `~/.claude/agents/` are never touched by `/update` (explicit `custom-` skip filter — see Update Safety)
- No registry or manifest needed — the `custom-` prefix is the convention

---

## Related Changes Required

This feature requires two additional changes delivered in the same release:

1. **`/update`** — add `custom-` skip filter to Step 4 (both first-run and incremental paths)
2. **`/quick`** — add custom agent fallback lookup before mode validation (see Dispatch section)

---

## Success Criteria

- [ ] Command runs with no arguments — all information gathered via Q&A
- [ ] All 6 templates produce a working, well-structured agent file
- [ ] Q2 name input is validated (lowercase, hyphens, no special characters)
- [ ] Q2 checks for existing `custom-{name}.md` and triggers overwrite warning immediately
- [ ] Q5 tool list defaults from template; invalid tool names are rejected with the valid list
- [ ] Preview shown before any file is written
- [ ] Change requests regenerate the preview; structural constraints (frontmatter, valid tools, `name:` field) are re-enforced on each regeneration
- [ ] Overwrite warning shown when `custom-{name}.md` already exists; returns to Q2 on "no"
- [ ] `name:` frontmatter field is always `custom-{name}` — matches filename exactly
- [ ] Written agent is immediately usable via `/quick <task> custom-{name}` after session restart
- [ ] `/update` ships with `custom-` skip filter — custom agents are never overwritten
- [ ] `/quick` ships with custom agent fallback lookup — `custom-{name}` dispatch works without alias registration
- [ ] Custom agent fallback runs before `/quick`'s mode validation step — no "Invalid mode" error for `custom-{name}:{anything}`
- [ ] `:mode` suffix on a custom agent token is discarded with a visible warning, not silently ignored
- [ ] `Agent` and `AskUserQuestion` are not offered in Q5 tool selection
- [ ] `blank` template still asks all 5 questions; Q3 prompt differs to elicit free-form role description
