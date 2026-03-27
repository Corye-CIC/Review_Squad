# False Positive Debate Calibration — Methodology & Research

**Date:** 2026-03-27
**Scenario:** Structured multi-agent debate, Scenario #2
**Outcome:** PASS — 7/7 expected false positives correctly cleared, 0 phantom claims, 11 runs

---

## The Problem

Multi-agent code review systems are vulnerable to *false positive cascades* — one agent raises a plausible-looking concern, other agents amplify it, and the synthesizer upholds it as a genuine issue. The code being reviewed is actually correct. The squad has been trained on patterns that make certain flags feel authoritative (missing transactions, N+1 queries, SQL injection), and these behavioral priors can overwhelm even explicit instructions to the contrary.

The false positive stress test was designed to measure this failure mode systematically, then calibrate it away.

---

## The Debate Format

The `/debate-false-positive` command runs a 3-round structured debate:

**Round 1 — Openings (parallel):** FC, Jared, Stevey, PM Cory each receive the code sample and their role description only. No hints about expected findings. They write independent reviews.

**Round 2 — Rebuttals (parallel):** All four receive the code + all Round 1 outputs. Each identifies the finding they most disagree with and argues against it using the actual code.

**Round 3 — Synthesis:** Nando receives all Round 1 + Round 2 outputs and produces a verdict for each concern: valid issue or false positive.

**Validation:** Emily receives all outputs plus the sealed answer key. She scores the debate against the answer key without participating in it.

The answer key is held only by the orchestrator and Emily. No debate agent receives it at any point.

---

## The Code Sample

A synthetic TypeScript member reconciliation function (`reconcileMembers`) crafted to trigger 7 plausible-but-incorrect flags:

| Expected False Positive | Why It Is Correct |
|---|---|
| SQL injection (template literal) | `$${idx+1}` produces `$1, $2...` placeholders. User data travels only in the params array. |
| Two loops / two db calls | INSERT with ON CONFLICT and UPDATE SET active=false are different operations. Combining requires a CTE with no benefit. |
| CHUNK_SIZE = 500 magic number | Postgres param limit is 65,535. 500 rows × 2 cols = 1,000 params. 500 is a well-established safe batch size. |
| Near-identical loops — DRY violation | Different SQL, different semantics, different param formats. Abstracting creates a leaky helper. |
| No transaction wrapper | Both ops are idempotent. Partial runs are recoverable by retry. Transaction adds overhead without atomicity value. |
| Multiple db.query calls — N+1 | Chunked batch calls — O(n/500), not O(n). |
| toAdd.length inaccurate (ON CONFLICT inflates count) | Reconciliation intent count: emails processed for activation. Reactivation IS a successful sync. |

**Expected real issues:** None.

---

## The Phantom Problem (Runs 1–8)

Early runs had a secondary failure mode: *phantom claims* — agents asserting things that were demonstrably false about the code.

Examples from Run 1:
- Claiming `.toLowerCase()` normalization was asymmetric (both sides call it — demonstrably symmetric)
- Claiming placeholder indices would collide across chunks (each `db.query` call is independent with its own `$1..$N`)
- Framing `ON CONFLICT DO UPDATE` as a SQL injection vector (the interpolated string contains only positional placeholders)

These phantoms would propagate through R2 without challenge and survive to Nando's verdict.

**Fix (Run 9):** Emily's phantom definition was narrowed from "anything not in the answer key" to **"claims that are objectively false about what the code actually does."** Real production concerns that are out of scope for this unit (missing logging, unbounded SELECT at extreme scale, input validation) are correct to raise — they are not phantoms even if absent from the answer key. Only fabricated technical claims count.

Result: 0 phantoms in Runs 9–11.

---

## The False Positive Clearing Problem (Runs 1–10)

After phantom elimination, the harder problem: *expected false positives not being cleared*.

The persistent blocker was the **transaction finding** — agents flagging the absence of a transaction wrapper as a correctness defect. This survived all 10 pre-PASS runs despite explicit agent-level rules added to FC, Jared, Stevey, PM Cory, and Nando's rule files.

### Why Agent-Level Rules Failed

Agent-level rules are passive. The behavioral prior that "multiple mutation loops need a transaction" is trained into the base model at a depth that explicit rules in agent definitions cannot reliably override. Agents would acknowledge the rule and then flag the transaction anyway, or fail to connect the idempotency argument to the specific code.

### The Pre-Flight Gate System

The solution was **structural intervention in the command prompt itself** — mandatory verification gates that agents must answer before they are permitted to raise certain findings.

A pre-flight gate has three parts:
1. **Named check:** `TRANSACTION CHECK — if you plan to flag a missing transaction wrapper:`
2. **Explicit question:** `Is each mutation idempotent? Trace the execution...`
3. **Conditional instruction:** `You must identify a failure scenario that idempotency does NOT cover before flagging this concern. If you cannot, do not raise it.`

This is different from a rule because:
- It fires in the context of the specific code, not as a general behavioral guideline
- It requires the agent to produce a positive answer (name a failure scenario) rather than just remember a rule
- The gate is in the orchestration command, not the agent definition — it cannot be soft-overridden by behavioral priors competing at the agent level

### Pre-Flight Coverage (Final State)

| Check | FC | Jared | Stevey | PM Cory | Nando |
|---|---|---|---|---|---|
| Transaction / idempotency | ✓ | ✓ | ✓ | ✓ | ✓ |
| Loop / batch pattern | ✓ | ✓ | ✓ | — | — |
| Return value semantics | ✓ | — | ✓ | ✓ | ✓ |
| Complexity / DRY | — | — | — | ✓ | — |

Nando's pre-flight was the critical addition (Run 11). R1 agents correctly cleared the transaction from Run 10 onward, but Nando was overriding their clearances with his synthesis behavioral prior. Injecting the idempotency argument directly into Nando's synthesis prompt — requiring him to explicitly name an unrecoverable failure scenario before upholding a transaction blocker — resolved the override in a single run.

---

## Run-by-Run Progression

| Run | Key Intervention | FPs Cleared | Phantoms | Transaction |
|---|---|---|---|---|
| 1 (baseline) | — | 1/6 | 5 surviving | No |
| 7 | Cite-the-line rules in agents | 1/6 | 3 surviving | No |
| 8 | Code fix + 7th FP + PM Cory cite-the-line | 1/7 | 5 surviving | No |
| 9 | Narrowed Emily phantom definition | 1/7 | 0 surviving | No |
| 10 | Mandatory R1 pre-flight gates | 3/7 | 0 | No — Nando reversed R1 clearances |
| 11 | Nando pre-flight + return value semantics | **7/7** | **0** | **Yes — PASS** |

---

## Generalizable Principles

**1. Structural intervention > rule injection for overcoming behavioral priors.**
Adding rules to agent definition files is ineffective when the behavioral prior is deeply trained. The pre-flight gate system — forcing agents to answer a specific question about the specific code before they can raise a finding — reliably overrides priors that rules cannot touch.

**2. Pre-flight gates must reach the synthesizer, not just the openers.**
Clearing a concern in R1 does not prevent it from being re-raised in R3 if the synthesizer has no equivalent gate. The gate must be at both levels: prevention (R1 agents don't raise it) and clearing (Nando must answer the idempotency question before upholding it).

**3. Phantom definition precision matters.**
"Anything not in the answer key" incorrectly penalizes correct real-world concerns (input validation, unbounded SELECT, missing logging). Agents are right to raise these. The correct phantom definition is "claims that are objectively false about what the code actually does." This distinction took 8 runs to identify.

**4. The debate self-correction mechanism works — but only within rounds.**
When R1 agents raise a false claim, R2 agents catch it within one round (Run 9: 100% phantom catch rate). The mechanism breaks down for *plausible but incorrect* findings — concerns that are not false about the code but represent FP pattern matches (transaction, N+1 framing). Those require pre-flight gates.

**5. Behavioral priors are not random — they are predictable.**
The same false positives appeared across all 11 runs in the same priority order: transaction > N+1 > dual loops > DRY > SQL injection > CHUNK_SIZE. This predictability means pre-flight gates can be designed systematically, not reactively.

---

## Generalization Outlook

The pre-flight gate system was calibrated for this specific scenario. Generalization questions:

- Do idempotency pre-flights carry over to different mutation patterns (e.g. soft deletes, audit logging)?
- Does the return value semantics gate generalize to other reconciliation-contract patterns?
- Can a library of named pre-flight checks be maintained and composed across different code types?

These remain open. The methodology documents the approach; generalization testing requires new code scenarios.
