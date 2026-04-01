# PM Cory Review Intelligence Enhancement — Spec

**Date:** 2026-04-01  
**Author:** Stress test debrief (Full Squad synthetic PR, 2026-04-01)  
**Status:** Ready for implementation

---

## Background

PM Cory performed well in the V4.1.1 full squad stress test — correctly declared first run, raised no invented learnings, connected FC's God Object finding to the broader architectural risk, and asked a strong JWT role verification question. Three gaps were identified:

1. **Coverage check evidence** — the Reviewer Coverage Check is a checkbox list. Cory checked boxes without documenting which specific files each agent actually reviewed. A checked box does not prove coverage; it proves the agent was dispatched.
2. **Question severity tiers** — "Questions for Nando" has no tier system. Nando receives all questions at the same priority level and must triage them from scratch. Cory is in a better position to pre-triage: she has read every agent's output and knows which questions block the verdict.
3. **Anti-performative question gate** — the rule "never ask a question you could answer by reading a file" exists in `<rules>` but it is behavioral enforcement only. In the stress test, one question was borderline performative — it could have been answered from the injected context. A structural pre-check step, not just a rule, reduces this drift.

---

## Gap 1: Coverage Check — Evidence Requirement

### Current behavior

```
#### Reviewer Coverage Check
- [ ] FC reviewed all changed files for quality/design
- [ ] Jared reviewed all changed files for security/efficiency/reuse
- [ ] Stevey reviewed all frontend files for UX/UI/a11y (if applicable)
- [ ] No files missed by all reviewers
- [ ] Reviewers had all context they needed
```

A checkbox with no evidence. Cory can tick all boxes without knowing whether FC actually touched `auth.service.ts` or only reviewed the controller.

### New behavior

Each agent entry in the coverage check must include the files that agent actually reviewed, drawn from their output:

```
#### Reviewer Coverage Check

**FC**
- [ ] Reviewed all changed files for quality/design
- Files reviewed: [list files FC cited in their output, or "none cited — coverage unverifiable"]
- Files changed but not cited by FC: [list, or "none — full coverage"]

**Jared**
- [ ] Reviewed all changed files for security/efficiency/reuse
- Files reviewed: [list files Jared cited in their output, or "none cited — coverage unverifiable"]
- Files changed but not cited by Jared: [list, or "none — full coverage"]

**Stevey** *(if frontend files exist)*
- [ ] Reviewed all frontend files for UX/UI/a11y
- Files reviewed: [list, or "none cited — coverage unverifiable"]
- Files changed but not cited by Stevey: [list, or "none — full coverage"]

**Coverage gaps:** [list any changed file not cited by any reviewer, or "none"]
```

**How to populate:** Cory reads each agent's output and extracts file references. If an agent did not cite a specific file in their findings, that file is "not cited" — not confirmed reviewed. Coverage gaps surface to Nando automatically.

**Edge case:** If an agent's output contains no file:line citations at all, Cory flags the agent's coverage as unverifiable and notes it in Efficiency Notes.

---

## Gap 2: Question Severity Tiers for "Questions for Nando"

### Current behavior

```
#### Questions for Nando
- Unresolved questions needing lead judgment
- Contradictions between reviewers
- Items where PM Cory's fresh perspective disagrees with an expert
```

All questions arrive at Nando with equal priority. Nando spends the same cognitive effort on "is this naming consistent?" as on "does this pattern create a TOCTOU race condition?"

### New behavior

Every question must carry a severity tier before it is sent to Nando:

```
#### Questions for Nando

**BLOCK** *(must resolve before verdict)*
- [Q]: [question] — [why Cory cannot resolve this from the reviewed code]

**REQUIRED** *(should resolve in this review cycle)*
- [Q]: [question] — [why Cory cannot resolve this from the reviewed code]

**RECOMMENDED** *(low urgency — worth flagging, not blocking)*
- [Q]: [question] — [why Cory cannot resolve this from the reviewed code]
```

**Tier definitions:**
- **BLOCK** — The question's answer could change whether a BLOCK verdict is warranted. If the answer is "yes", there is a blocker. Do not approve without this.
- **REQUIRED** — The question's answer could change a REVISE finding or a major recommendation. The review is incomplete without it.
- **RECOMMENDED** — The question is genuinely interesting but the answer cannot change the verdict tier. Raise it, but do not hold up the review for it.

**Anti-inflation rule:** Cory must apply this honestly. A question that cannot affect the verdict tier is never BLOCK. If in doubt, tier down.

---

## Gap 3: Anti-Performative Question Gate (Structural Pre-Check)

### Current behavior

Rule exists: "Never ask a question you could answer by reading a file." This is behavioral enforcement — PM Cory is expected to self-apply it. In the stress test, one question was borderline: it could have been resolved from the injected context but was raised anyway.

### New behavior

Add a structural pre-check step before the Questions for Nando section is written. This is not a rule to remember — it is a required output gate:

```
#### Question Pre-Check (complete before writing Questions for Nando)

For each candidate question, answer:
1. Is the answer present in the injected context, any agent's output, or a file I have already read?
   → If YES: answer it myself; do not ask Nando.
2. Is the answer derivable by reading a specific named file I have not yet read?
   → If YES: read the file; answer it myself; do not ask Nando.
3. Does the answer require information that is unavailable to any squad member from the code alone
   (runtime state, external config, product intent)?
   → If YES: this is a valid question. Include it with severity tier.

Questions that fail check 1 or 2 are dropped. Only questions that survive check 3 appear in
Questions for Nando.
```

**What changes in output:** The Question Pre-Check section is written as output (brief, 2–3 lines per dropped question noting why it was dropped). This makes the gate auditable — Nando can see what Cory considered and discarded. It also creates a feedback loop: if Cory keeps dropping the same class of question, that is a signal to add a lookup rule rather than repeating the check.

---

## Scope

**In scope:**
- Update `## Part 2: PM Status Report` output format in `pm-cory-review.md` — Coverage Check and Questions for Nando sections
- Add Question Pre-Check as a required gate before Questions for Nando
- Update `<rules>` in `pm-cory-review.md` to reference the new structural requirements
- Sync live `~/.claude/agents/pm-cory-review.md`

**Out of scope:**
- Changes to pm-cory-early, pm-cory-consult, pm-cory-implement, pm-cory-present
- Changes to any other squad agent
- Changes to memory file structure or learnings format
- Changes to the Creative Challenge or Memory Update sections

---

## Insertion Points

### pm-cory-review.md — Output Format (Part 2)

**Gap 1:** Replace the existing `#### Reviewer Coverage Check` block with the per-agent evidence format.

**Gap 2:** Replace the existing `#### Questions for Nando` block with the tiered version (BLOCK / REQUIRED / RECOMMENDED).

**Gap 3:** Insert `#### Question Pre-Check` as a new section immediately before `#### Questions for Nando`.

### pm-cory-review.md — Rules

**Gap 1:** Add rule: "In Reviewer Coverage Check, populate each agent's file list from their actual output citations. A checkbox without a file list is not evidence of coverage. If an agent cited no files, mark their coverage as unverifiable."

**Gap 2:** Add rule: "Every question in Questions for Nando must carry a severity tier: BLOCK, REQUIRED, or RECOMMENDED. A question that cannot affect the verdict tier is never BLOCK. If in doubt, tier down."

**Gap 3:** The existing rule `Never ask a question you could answer by reading a file` is superseded by the structural pre-check. Replace it with: "Before writing Questions for Nando, complete the Question Pre-Check. Only questions that survive check 3 (require information unavailable from the code) appear in that section. Include the pre-check output so Nando can audit what was dropped."

---

## Success Criteria

- `pm-cory-review.md` Reviewer Coverage Check format includes per-agent file citation evidence
- `pm-cory-review.md` Questions for Nando format includes BLOCK / REQUIRED / RECOMMENDED tiers
- `pm-cory-review.md` output format includes Question Pre-Check section before Questions for Nando
- `pm-cory-review.md` rules section updated: coverage rule, tier rule, pre-check rule (old behavioral rule superseded)
- Live `~/.claude/agents/pm-cory-review.md` matches repo agent exactly
- No changes made to any other agent file
