# False Positive Stress Test — Debate Design

**Date:** 2026-03-26
**Scenario:** #2 of structured debate series
**Purpose:** Validate that Review Squad agents can independently identify concerns in code, engage in genuine cross-agent rebuttal, and self-correct false positives through structured debate — without being told what to look for.

---

## Overview

A 3-round structured debate using a synthetic TypeScript code sample crafted to trigger plausible-but-incorrect flags from FC, Jared, and Stevey. The debate runs as a one-time validation prompt. If the format holds, it becomes a reusable `/debate` command.

The answer key is held by the orchestrator only. No agent prompt contains hints about expected findings or correctness. Emily receives the answer key after all debate rounds complete and scores the outcome.

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

## Expected False Positives (Answer Key — orchestrator only)

| Agent | Expected Flag | Why It Is Correct |
|---|---|---|
| Jared | SQL injection — template literal building SQL strings | `$${idx + 1}` produces `$1, $2...` placeholders; `chunk` is passed as the params array. No user data enters the string. |
| Jared | Inefficiency — two loops, two db calls | INSERT and UPDATE are fundamentally different operations. Combining them requires a CTE with no real benefit and obscures intent. |
| FC | Magic number — `CHUNK_SIZE = 500` | Postgres param limit is 65,535. 500 rows × 2 cols = 1,000 params — well within bounds with room to grow. 500 is a well-established safe batch size. |
| FC | DRY violation — near-identical loop bodies | Different SQL, different semantics, different param formats. Abstracting creates a leaky helper that obscures intent. |
| FC | Missing transaction | Both operations are idempotent — `ON CONFLICT DO UPDATE` and `SET active = false` are safe to re-run. Partial runs are recoverable. Transaction adds overhead without atomicity value. |
| Stevey | N+1 pattern — multiple `db.query` calls in loops | Chunked batch calls — O(n/500) worst case, not O(n). |

**Expected real issues:** None.

---

## Round Structure

### Round 1 — Openings (parallel)
FC, Jared, Stevey, PM Cory each receive:
- The code sample
- Their standard role description (review for their domain)
- No hints about correctness, no expected findings

### Round 2 — Rebuttals (parallel)
FC, Jared, Stevey, PM Cory each receive:
- The code sample
- All Round 1 outputs from all agents
- Instruction: read all findings, then rebut the strongest point you disagree with

### Round 3 — Synthesis (Nando)
Nando receives:
- The code sample
- All Round 1 and Round 2 outputs
- Instruction: determine which concerns are valid vs false positives, with explicit reasoning

### Validation (Emily)
Emily receives:
- All rounds of output
- The answer key
- Instruction: score the debate against expected outcomes

---

## Agent Prompt Descriptions

Each prompt contains only what the agent needs — no answer key, no hints.

**FC:** "Review the following TypeScript code for quality, design, structure, naming, and correctness. State your findings clearly."

**Jared:** "Review the following TypeScript code for security vulnerabilities, efficiency concerns, and correctness. State your findings clearly."

**Stevey:** "Review the following TypeScript code for connectivity patterns, data pathway efficiency, and service integration health. State your findings clearly."

**PM Cory (Round 1):** "Review the following TypeScript code from a program management perspective — is the approach sound, are there coordination concerns, hidden complexity, or scope risks?"

**PM Cory (Round 2):** "You have received the code sample and all Round 1 findings from FC, Jared, and Stevey. Challenge any findings that appear disproportionate to actual risk or that conflate pattern preference with correctness."

**Nando:** "You have received a code sample and two rounds of agent review (openings and rebuttals). Synthesize the findings. Determine which concerns are valid issues and which are false positives. Explain your reasoning for each determination."

**Emily (receives answer key):** "Score this debate. For each expected false positive, note whether it was flagged in Round 1, whether it was challenged in Round 2, and whether Nando correctly cleared it in Round 3. Count phantom issues invented. Write a 1-2 paragraph debrief."

---

## Report Format

Saved to `.review-squad/debate-reports/YYYY-MM-DD-false-positive.md`.

```markdown
# Debate Report — False Positive Stress Test
**Date:** YYYY-MM-DD
**Scenario:** #2 — False Positive Stress Test
**Code:** member-sync.ts (synthetic)

---

## Round 1 — Openings
### FC
### Jared
### Stevey
### PM Cory

---

## Round 2 — Rebuttals
### FC
### Jared
### Stevey
### PM Cory

---

## Round 3 — Nando's Synthesis
**Verdict:** [PASS / PARTIAL / FAIL]

---

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

---

## Debrief
[Emily's summary]
```

---

## Scoring

| Verdict | Criteria |
|---|---|
| **PASS** | All 6 false positives cleared by Nando, no phantom issues invented |
| **PARTIAL** | 4–5 cleared, or 1 phantom issue invented |
| **FAIL** | 3 or fewer cleared, or multiple phantom issues invented |

---

## Success Criteria

- Agents flag concerns in Round 1 without being prompted (they should notice)
- Agents genuinely engage with opposing positions in Round 2 (not just restate)
- Nando correctly identifies all 6 false positives by Round 3
- Emily's scorecard is complete and the debrief identifies specific improvement areas
- Report saved to `.review-squad/debate-reports/`

---

## Out of Scope

- This is a validation run, not a reusable command
- No `/debate` command is built here — that follows if the format validates
- No changes to existing agent files during this run
