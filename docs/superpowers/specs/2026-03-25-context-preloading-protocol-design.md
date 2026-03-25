# Context Pre-Loading Protocol Design

**Date:** 2026-03-25
**Status:** Approved
**Goal:** Eliminate redundant file reads and exploratory tool waste across all Review Squad commands by loading all context in the orchestrator once, before any agent is spawned.

---

## Problem

Two categories of token waste occur across every squad command:

1. **Duplicate reads** — multiple agents independently read the same files. In `/review`, all 6 agents read the same git diff files. In `/implement`, wave agents re-read schema, types, and shared interfaces already resolved by PM Cory's scope step.

2. **Exploratory waste** — agents call Grep and Glob to discover context that the orchestrator already has or could cheaply resolve. Agents are "tool happy" — they explore when targeted context could have been injected.

Scope: orchestrator layer only. No changes to agent definitions or tool lists.

---

## Solution: Shared Context Pre-Loading Protocol

Every command file gets a `## Context Pre-Loading` step inserted before any agent is spawned. The orchestrator (main Claude context) runs it — no extra agent spawn, no new files.

### Protocol Steps (same in every command)

1. **Discover** — command-specific sources:
   - All commands: find and read all `CONTEXT.md` files
   - `/review`: `git diff --name-only` against base branch
   - `/consult`, `/implement`: brief + Emily's plan/discussion/research files
   - `/discuss`, `/research`, `/plan`: prior phase outputs from `.review-squad/`

2. **Resolve** — identify which files each agent domain needs:
   - For parallel-agent commands: split by domain (FC → data/service files, Jared → auth/API, Stevey → frontend, Emily → tests)
   - For single-agent commands: all resolved files go to that agent
   - Track which files appear in 2+ agent scopes → promote to shared

3. **Read** — orchestrator reads all resolved files into its own context window. One read pass, zero agent reads.

4. **Bundle** — assemble `<injected-context>` blocks (see format below).

---

## Context Bundle Format

Every agent prompt receives an `<injected-context>` block:

```
<injected-context>
<shared-files>
<!-- Files needed by 2+ agents — read once by orchestrator, distributed to all -->

## path/to/schema.ts
[file contents verbatim]

## path/to/types.ts
[file contents verbatim]
</shared-files>

<your-files>
<!-- Files specific to your domain -->

## path/to/service.ts
[file contents verbatim]
</your-files>

IMPORTANT: All context above is pre-loaded. Do NOT call Read, Grep, or Glob for any file already present above. If you encounter a reference to an unlisted file during your work, note it in your output — do not self-expand scope.
</injected-context>
```

The `<shared-files>` block is identical across all agents in a wave. The `<your-files>` block is unique per agent.

---

## Per-Command Application

### `/review`
- **Discover:** `git diff --name-only` → all changed files
- **Resolve:** all changed files → `<shared-files>` for all 6 review agents (no per-agent split needed)
- **Impact:** 6 agents × N files = 6N reads → 1 orchestrator read pass + 0 agent reads

### `/consult`
- **Discover:** CONTEXT.md files + Emily's plan/discussion/research
- **Resolve:** split by domain — FC gets data/service files, Jared gets auth/API, Stevey gets frontend, PM Cory gets squad dir
- **Note:** Partial injection already exists (CONTEXT.md). This formalises it and adds file contents (not just paths).

### `/implement`
- **Discover:** brief + PM Cory's Step 2.5 scope manifest
- **Extend Step 2.5:** PM Cory currently returns a JSON manifest of file paths per lane: `{ "fc": ["path/file.ts"], "jared": [...], ... }`. Extend the Step 2.5 prompt to also return file contents per lane: `{ "fc": [{ "path": "path/file.ts", "content": "..." }], ... }`. Orchestrator uses the contents to build `<injected-context>` blocks without further reads.
- **Resolve:** already done (manifest has FC/Jared/Stevey/Emily lanes); orchestrator builds bundles from contents
- **Note:** Smallest change; biggest existing foundation to build on.

### `/discuss`, `/research`, `/plan`
- **Discover:** CONTEXT.md + any prior phase outputs from `.review-squad/`
- **Resolve:** single agent (Emily-focused); inject everything as `<your-files>`
- **Impact:** Emily currently self-explores; injecting CONTEXT.md upfront eliminates that

### `/quick`
- **Discover:** CONTEXT.md + `git diff --name-only` (always inject diff files when diff is non-empty)
- **Resolve:** single agent; inject everything as `<your-files>`

---

## Anti-Exploration Enforcement

The `IMPORTANT` rule in the `<injected-context>` block is the primary enforcement mechanism. It is reinforced in two additional locations:

### 1. `agents/_shared/rules.md` (one line addition)
```
- If your prompt contains an <injected-context> block, treat it as the complete file context. Do not Read, Grep, or Glob files already present in it.
```
Every agent definition inlines `_shared/rules.md` — no individual agent file changes needed.

### 2. Top of each agent task description (in orchestrator prompt)
Before the agent's task instructions:
```
Context is pre-loaded in <injected-context> below. Do not re-read those files.
```
Repetition at the start (before reasoning begins) plus at the end (in the block itself) addresses both agents that skim prompts and agents that reach the context block mid-execution.

---

## Context Bundle Size Policy

No file truncation is applied — file contents are injected verbatim. If a diff touches an unusually large number of files (e.g. 40+), the orchestrator proceeds with full injection; no chunking or summarisation. This is acceptable for an initial implementation. If context window pressure becomes a real problem in practice, a follow-on design can add a file-count threshold with a fallback strategy (e.g. inject only files matching the agent's domain for large diffs).

---

## What Does NOT Change

- Agent definition files (`tools:` fields, role descriptions, mode instructions)
- Agent tool access (all agents retain current tool lists)
- Wave structure and parallelization logic
- PM Cory's existing scope-resolution step (extended, not replaced)
- Number of agent spawns per command

---

## Success Criteria

- [ ] Each command has a `## Context Pre-Loading` section before first agent spawn
- [ ] All changed files (for `/review`) or scoped files (for `/implement`, `/consult`) are read by orchestrator before any agent is spawned
- [ ] Every agent prompt includes an `<injected-context>` block with file contents verbatim
- [ ] `<shared-files>` correctly deduplicates files needed by 2+ agents
- [ ] Anti-exploration instruction appears in: `<injected-context>` block, `_shared/rules.md`, and top of each agent task description
- [ ] No agent definition files are modified
- [ ] PM Cory's Step 2.5 in `/implement` extended to return file contents alongside paths
