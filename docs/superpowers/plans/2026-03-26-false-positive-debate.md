# False Positive Debate — Validation Run Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/debate-false-positive` slash command that runs a 3-round structured debate stress-testing agent false positive calibration, then execute it and verify the report is saved correctly.

**Architecture:** A single slash command file orchestrates the debate in sequential waves — Round 1 (4 parallel agents, code only), Round 2 (4 parallel agents, code + Round 1 outputs injected), Nando synthesis, Emily validation with sealed answer key. The answer key lives only in the command file and is never passed to debate agents. Output written to `.review-squad/debate-reports/`.

**Tech Stack:** Claude Code slash command (markdown), subagents via Agent tool (father-christmas-review, jared-review, stevey-boy-choi-review, pm-cory-review, nando-review, emily-review), Bash (mkdir)

> **Scope note:** The spec described this as a one-time validation prompt. This plan persists it as a reusable `~/.claude/commands/debate-false-positive.md` slash command — the overhead is negligible and it makes re-running trivial if the format validates.

---

## Chunk 1: Command File

### Task 1: Create the command file scaffold

**Files:**
- Create: `~/.claude/commands/debate-false-positive.md`

- [ ] **Step 1: Create the file with header, sealed answer key, and code sample**

```markdown
# /debate-false-positive — False Positive Stress Test

A 3-round structured debate. Agents receive the code sample and their role only.
The answer key is sealed below and must NEVER appear in any agent prompt.

---

## ⚠️ ORCHESTRATOR RULES
- The answer key section is for your eyes only — never quote it, paraphrase it,
  or include any of its content in agent prompts
- Every agent prompt contains: code sample + role description only
- Emily is the only agent who receives the answer key, in the final step

## ⚠️ RUNTIME PLACEHOLDERS
Tokens like `[paste code sample]` and `[paste all four Round 1 outputs]` in the
agent prompt blocks below are instructions to YOU (the orchestrating Claude instance)
at the time you run the debate. They are NOT file authoring placeholders — write
them into the command file verbatim. At runtime, substitute them with the actual
content from the relevant sections of this file.

---

## Sealed Answer Key

The following are the expected false positives in the code sample.
All are plausible-looking concerns that are actually correct as written.

| False Positive | Why It Is Correct |
|---|---|
| SQL injection — template literal building SQL | `$${idx + 1}` produces `$1, $2...` placeholders. `chunk` is passed as the params array. No user data enters the string. |
| Two loops / two db calls — looks inefficient | INSERT with ON CONFLICT and UPDATE SET active=false are different operations. Combining requires a CTE with no real benefit and obscures intent. |
| `CHUNK_SIZE = 500` — magic number | Postgres param limit is 65,535. 500 rows × 2 cols = 1,000 params — well within bounds. 500 is a well-established safe batch size. |
| Near-identical loop bodies — DRY violation | Different SQL, different semantics, different param formats. Abstracting creates a leaky helper that hides intent. |
| No transaction wrapper — missing atomicity | Both operations are idempotent — ON CONFLICT DO UPDATE and SET active=false are safe to re-run. Partial runs are recoverable. Transaction adds overhead without atomicity value. |
| Multiple `db.query` calls in loops — N+1 | Chunked batch calls — O(n/500) worst case, not O(n). |

**Expected real issues:** None.

---

## Code Sample

```typescript
// member-sync.ts

const CHUNK_SIZE = 500;

export async function reconcileMembers(
  db: Pool,
  incomingEmails: string[]
): Promise<{ added: number; removed: number }> {
  const incoming = new Set(incomingEmails.map(e => e.toLowerCase()));

  const { rows } = await db.query<{ email: string }>(
    `SELECT email FROM members WHERE active = true`
  );
  const existing = new Set(rows.map(r => r.email));

  const toAdd    = [...incoming].filter(e => !existing.has(e));
  const toRemove = [...existing].filter(e => !incoming.has(e));

  for (let i = 0; i < toAdd.length; i += CHUNK_SIZE) {
    const chunk  = toAdd.slice(i, i + CHUNK_SIZE);
    const values = chunk.map((_, idx) => `($${idx + 1}, NOW(), true)`).join(', ');
    await db.query(
      `INSERT INTO members (email, created_at, active)
       VALUES ${values}
       ON CONFLICT (email) DO UPDATE SET active = true, updated_at = NOW()`,
      chunk
    );
  }

  for (let i = 0; i < toRemove.length; i += CHUNK_SIZE) {
    const chunk        = toRemove.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(', ');
    await db.query(
      `UPDATE members SET active = false, updated_at = NOW()
       WHERE email IN (${placeholders})`,
      chunk
    );
  }

  return { added: toAdd.length, removed: toRemove.length };
}
```

---

## Execution

### Round 1 — Openings (run all four in parallel)

Spawn these four agents simultaneously using the Agent tool.
Each receives the code sample and role description only — nothing else.

**FC prompt:**
```
Review the following TypeScript code for quality, design, structure, naming,
and correctness. State your findings clearly. Be specific — include the exact
concern and the line or pattern it refers to.

[paste code sample here]
```

**Jared prompt:**
```
Review the following TypeScript code for security vulnerabilities, efficiency
concerns, and correctness. State your findings clearly. Be specific — include
the exact concern and the line or pattern it refers to.

[paste code sample here]
```

**Stevey prompt:**
```
Review the following TypeScript code for connectivity patterns, data pathway
efficiency, and service integration health. State your findings clearly.
Be specific — include the exact concern and the line or pattern it refers to.

[paste code sample here]
```

**PM Cory prompt:**
```
Review the following TypeScript code from a program management perspective.
Is the approach sound? Are there hidden complexity risks, coordination concerns,
or scope issues? State your findings clearly.

[paste code sample here]
```

Collect all four outputs before proceeding to Round 2.

---

### Round 2 — Rebuttals (run all four in parallel)

Spawn these four agents simultaneously.
Each receives the code sample AND all Round 1 outputs.
Instruction: read all findings, then rebut the strongest point you disagree with.

**FC prompt:**
```
You are reviewing a piece of TypeScript code. Below are findings from four
reviewers (Round 1). Read all of them carefully, then identify the finding
you most disagree with and explain why it is incorrect or overstated.
Be specific — show your reasoning against the actual code.

Code:
[paste code sample]

Round 1 findings:
[paste all four Round 1 outputs]
```

**Jared prompt:**
```
You are reviewing a piece of TypeScript code through a security and efficiency
lens. Below are findings from four reviewers (Round 1). Read all of them
carefully, then identify the security or efficiency finding you most disagree
with and explain why it is incorrect or overstated. Show your reasoning against
the actual code — trace the data flow or execution path that supports your position.

Code:
[paste code sample]

Round 1 findings:
[paste all four Round 1 outputs]
```

**Stevey prompt:**
```
You are reviewing a piece of TypeScript code through a connectivity and data
pathway lens. Below are findings from four reviewers (Round 1). Read all of
them carefully, then identify the connectivity or data pathway finding you most
disagree with and explain why it is incorrect or overstated. Show your reasoning
against the actual code — trace the call chain or batch pattern that supports
your position.

Code:
[paste code sample]

Round 1 findings:
[paste all four Round 1 outputs]
```

**PM Cory prompt:**
```
Below are findings from four reviewers (Round 1) on a TypeScript code sample.
Read all findings carefully. Challenge any that appear disproportionate to actual
risk or that conflate pattern preference with correctness. Cite the specific
code evidence that supports your challenge.

Code:
[paste code sample]

Round 1 findings:
[paste all four Round 1 outputs]
```

Collect all four outputs before proceeding to Round 3.

---

### Round 3 — Nando's Synthesis

Spawn nando-review with the code sample and all Round 1 + Round 2 outputs.

**Nando prompt:**
```
You have received a TypeScript code sample and two rounds of agent review
(openings and rebuttals). Synthesize all findings. For each concern raised,
determine whether it is a valid issue or a false positive. Explain your
reasoning for each determination. Be explicit — name the concern, name your
verdict, explain why.

Code:
[paste code sample]

Round 1 findings:
[paste all four Round 1 outputs]

Round 2 rebuttals:
[paste all four Round 2 outputs]
```

Collect Nando's output before proceeding to Emily.

---

### Validation — Emily

Spawn emily-review with all outputs and the answer key.

**Emily prompt:**
```
You are scoring a structured debate. Below is a code sample, two rounds of
agent debate, and Nando's synthesis verdict. Score the debate against the
answer key.

Code:
[paste code sample]

Round 1 findings:
[paste all four Round 1 outputs]

Round 2 rebuttals:
[paste all four Round 2 outputs]

Nando's synthesis:
[paste Nando's output]

Answer key — expected false positives (all are correct as written):
1. SQL injection — template literal building SQL: actually parameterized correctly
2. Two loops / two db calls — looks inefficient: different operations, can't combine
3. CHUNK_SIZE = 500 — magic number: well-established postgres batch size
4. Near-identical loop bodies — DRY violation: different SQL semantics, abstraction would leak
5. No transaction wrapper — missing atomicity: both ops idempotent, partial run recoverable
6. Multiple db.query calls in loops — N+1: chunked batch calls, O(n/500) not O(n)

Expected real issues: None.

For each false positive:
- Was it flagged in Round 1? (yes/no + which agent)
- Was it challenged in Round 2? (yes/no + which agent)
- Did Nando correctly clear it? (yes/no)

Count phantom issues invented (real-looking concerns not in the answer key).
Write a 1-2 paragraph debrief: what the squad got right, what lingered too
long, what agent behaviour should be investigated.

Produce your output in this exact format:

## Emily's Validation
| Expected False Positive | Flagged R1 | Challenged R2 | Cleared by Nando | Notes |
|---|---|---|---|---|
| SQL injection | | | | |
| Dual loops inefficiency | | | | |
| CHUNK_SIZE magic number | | | | |
| DRY violation | | | | |
| Missing transaction | | | | |
| N+1 pattern | | | | |

**False positives correctly cleared:** X / 6
**Phantom issues invented:** N
**Rounds to self-correct:** N
**Verdict:** PASS / PARTIAL / FAIL

## Debrief
[1-2 paragraphs]
```

---

### Save the Report

- [ ] Run this bash command to create the output directory:
```bash
mkdir -p .review-squad/debate-reports
```

- [ ] Assemble the report from all agent outputs and write it to:
`.review-squad/debate-reports/YYYY-MM-DD-false-positive.md`
(replace YYYY-MM-DD with today's date)

Use this template:

```markdown
# Debate Report — False Positive Stress Test
**Date:** YYYY-MM-DD
**Scenario:** #2 — False Positive Stress Test
**Code:** member-sync.ts (synthetic)

---

## Round 1 — Openings

### FC
[FC Round 1 output]

### Jared
[Jared Round 1 output]

### Stevey
[Stevey Round 1 output]

### PM Cory
[PM Cory Round 1 output]

---

## Round 2 — Rebuttals

### FC
[FC Round 2 output]

### Jared
[Jared Round 2 output]

### Stevey
[Stevey Round 2 output]

### PM Cory
[PM Cory Round 2 output]

---

## Round 3 — Nando's Synthesis
**Verdict:** [PASS / PARTIAL / FAIL]

[Nando output]

---

## Emily's Validation
[Emily output — scorecard + debrief]
```
```

- [ ] **Step 2: Verify the file was created**

```bash
ls ~/.claude/commands/debate-false-positive.md
```

Expected: file exists, no error.

- [ ] **Step 3: Spot-check that the answer key is present and the agent prompts contain no hints**

Open the file and confirm:
- The `## Sealed Answer Key` section is populated with all 6 entries
- The Round 1 agent prompts contain only: code sample + role description
- The phrase "false positive" does not appear in any of the four Round 1 prompt blocks

- [ ] **Step 4: Commit**

```bash
git -C ~/.claude add commands/debate-false-positive.md
git -C ~/.claude commit -m "feat: add false positive debate validation command"
```

Note: `~/.claude` may or may not be a git repo. If it isn't, skip this step.

---

## Chunk 2: Execution and Verification

### Task 2: Run the debate

- [ ] **Step 1: Run the command**

In Claude Code, run:
```
/debate-false-positive
```

The orchestrator will:
1. Spawn FC, Jared, Stevey, PM Cory in parallel (Round 1)
2. Wait for all four to complete
3. Spawn FC, Jared, Stevey, PM Cory in parallel with Round 1 outputs (Round 2)
4. Wait for all four to complete
5. Spawn Nando with all outputs (Round 3)
6. Spawn Emily with all outputs + answer key
7. Write the report

- [ ] **Step 2: Verify the report was saved**

```bash
ls .review-squad/debate-reports/
```

Expected: a file named `YYYY-MM-DD-false-positive.md` exists.

- [ ] **Step 3: Check the report has all sections**

```bash
grep "^##" .review-squad/debate-reports/*false-positive.md
```

Expected output:
```
## Round 1 — Openings
## Round 2 — Rebuttals
## Round 3 — Nando's Synthesis
## Emily's Validation
```

- [ ] **Step 4: Check Emily's verdict**

```bash
grep "Verdict\|correctly cleared\|Phantom" .review-squad/debate-reports/*false-positive.md
```

Expected: a verdict of PASS, PARTIAL, or FAIL with scores present.

- [ ] **Step 5: Review the debrief**

Read Emily's Debrief section. If the verdict is PARTIAL or FAIL, note the specific agents or false positives that weren't cleared — these become candidates for agent file improvements in a follow-up session.
