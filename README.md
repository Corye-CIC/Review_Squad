# Review Squad — Claude Code Sub-Agents

A 6-agent review and development squad for [Claude Code](https://claude.com/claude-code). The squad covers the full development lifecycle from discussion through shipping, with specialized agents handling code quality, security, UX, program management, architectural oversight, and product management.

> **V4.3** — Observability, integrity, cross-project memory, and plugin packaging. **Phase 1 (Observability):** `hooks/squad-telemetry.js` records squad events (verdicts, auto-fix rounds, fleet shards, command invocations) to `~/.claude/projects/<project>/memory/squad-metrics.jsonl`; `/squad-metrics` summarizes by period and project with closed-loop effectiveness signals; `/squad-health` audits installation integrity (agent files, commands, hooks, project-rules, hook wiring, version drift, gh auth) with `--fix` for safe auto-repair. **Phase 2 (Plugin Packaging):** `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` enable one-command install via `claude plugin add` + `claude plugin install`; README adds Option A (plugin) alongside the existing manual Option B. **Phase 3 (Cross-Project Memory):** new `squad-patterns/` directory with 4 files seeded from 515 labeled learning lines across campaign-management / llama.cpp / SubAgents projects — Tier A domain patterns (type safety, unimplemented features, null-safety), Tier B tooling patterns (agent mode-specificity, cold-start edges, output routing, prescriptive rules), verdict-trends by project type, and auto-fix classification decision flow. PM Cory's `early`, `consult`, and `review` agents updated to read both per-project and global stores and cite matching patterns by name. `/update-reviewsquad` extended to sync `squad-patterns/*.md` and `hooks/squad-telemetry.js`. **Phase 4 (Monorepo /fleet) deferred** pending Phase 1 telemetry signal — build only if `/fleet` sees 3+ real refactors per month. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v4.3.html)
>
> **V4.2** — Lifecycle extensions driven by `/insights` friction analysis. **Five new commands:** `/handoff` (structured session-state snapshot; auto-invoked by `/review` on REVISE/BLOCK when context is constrained), `/review-auto` (closed-loop: `/review` → classify → auto-apply NIT + MUST-FIX-SAFE fixes via squad implement agents → re-review; iteration cap 2, hard safeguards on migrations/secrets/package.json/Jared-flagged items), `/fleet` (parallel worktree orchestration for phased refactors, max 10 shards, isolated per-worktree Postgres DB, sequential rebase-merge with typecheck/lint validation, auto-invokes `/review` on merged range), `/ui-iterate` (test-driven theme iteration with Playwright visual regression + axe-core fitness scoring), `/sync-upstream` (automates cp → commit → push for squad meta-work). **`/review` Step 0 pre-flight gate:** blocks squad dispatch on typecheck/lint failure, branch mismatch against linked PR, or working tree irregularities. **`/ship` additions:** Step 1b.1 branch assertion against linked PR, Step 1g commit hygiene validation (opt-in via `@~/.claude/project-rules/commit-hygiene.md`). **New `project-rules/` directory** ships opt-in per-project rules (`commit-hygiene.md`, `dev-environment.md`). **Hook skip behavior:** `review-squad-gate.js` now suppresses advisory on Review_Squad meta-work, `~/.claude/` edits, and pure-docs diffs. **Gotchas sections** added to all five new commands per Anthropic's internal data showing measurable accuracy gains. Emily and Stevey review agents now check `.review-squad/<project>/ui-iterations/` for recent fitness reports when theme changes are in the diff. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v4.2.html)
>
> **V4.1.4** — `/debate` voice discipline + 3-round structure: three classes of fixes from Review Squad transcript analysis. Class 1 (systemic): banned `"[Name] didn't just [verb]"` opener; rebuttal prompts now require agents engage a named peer first, then Nando — `"Nando called it X — but"` opener explicitly blocked. Class 2 (per-agent tics): voice profiles converted from descriptive prose to hard RULES with must-appear-once-per-turn constraints — Emily (`"Look"`, ≤6-word sentence, end on human/dollar, dash self-interrupt), FC (25-word sentence cap, landing closer), Jared (`"The problem is"`, parenthetical sardonic aside, cold open), PM Cory (`"Sure, X — but"`, `"Here's the thing"`, dash self-interrupt), Nando (first-name direct call-outs, every assessed agent named). Class 3 (structural): Round 3 added — each agent posts one falsifiable claim before final verdict; steelman required in opening prompts; judging criteria stated in Nando's opening announcement. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v4.1.4.html)
>
> **V4.1.3** — `/debate` orchestrator overhaul: 2-round structure (opening statements → Nando interim verdict → rebuttals → final verdict); Nando names the Round 1 leader and calls out weak arguments explicitly, then is free to reverse on strong rebuttals (`VERDICT CHANGED:` / `VERDICT STANDS:`); `spawnSync` replaces `execSync` (no shell, no injection); parallel agent connections via `Promise.all`; 10-second connect timeout with hard reject; `ws.once` prevents duplicate ack handlers; debate config written with `0o600` permissions; `post()` delay reduced from 900ms to 100ms; `POST /clear` HTTP endpoint clears server history at debate start so a browser refresh always shows a clean room; dashboard `history-cleared` lifecycle event now handled in UI. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v4.1.3.html)
>
> **V4.1.2** — Emily + PM Cory review intelligence enhancements. Emily: Pre-Implementation Gate fires on cold reviews of auth/security/token/PII/compliance features; Requirements Coverage split into Defined Criteria (implementation failures) vs Undefined Criteria (spec gaps); CHALLENGE items require a `Grounded in:` citation to a specific file:line, plan item, or requirement — ungroundable items demote to a new Open Questions section; PM Cory Cross-Session Notes now has an explicit sourcing path. PM Cory: Coverage Check now requires per-agent file lists drawn from reviewer citations (checkbox alone is not evidence); Question Pre-Check gate blocks self-expansion of out-of-scope questions with an auditable dropped-questions log; all Questions for Nando carry BLOCK / REQUIRED / RECOMMENDED severity tiers; new Verdict Recommendation template; output descriptor section names aligned to actual headings. Both agents passed a full Review Squad self-review run (REVISE verdict applied and cleared). — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v4.1.2.html)
>
> **V4.1.1** — Eight precision fixes to Nando from Review Squad REVISE verdict on V4.1: Protocol 1 grounding check adapted to consult context (brief/symbol, not `file:line`); implement-mode Fail check 3 now routes to Path 3 deviation protocol (not a missing output section); canonical preamble made mode-neutral ("applies the subset relevant to the active mode"); `<!-- sourced from -->` comments replaced with mode-specific `<!-- adapted from -->` comments; "Commit atomically" rule removed from consult mode; fractional process step numbers (1.5, 1.75) renumbered to whole integers in both consult and review; docs/nando.md consult process updated with Scope Gate and Finding Validity Pre-Check steps, Lead Architect Intelligence bullet rewritten to distinguish mode scope; frontmatter description updated to include CONDITIONAL APPROVE verdict. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v4.1.1.html)
>
> **V4.1** — Nando Architect Intelligence Layer (Finding Validity Pre-Check, Cross-Agent Convergence Check, Verdict Integrity Check) — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v4.1.html)
>
> **V4.0** — **Craft Intelligence** added to Father Christmas (all four modes): 8-smell code smell taxonomy, naming precision rules, structure standards with hard limits, quality enforcement tiers (REJECT/WARN/NOTE), SOLID deep cuts with violation examples, design pattern use/don't-use guidance, and elegance heuristics. Database Authority extended with formal query pattern rules, index intelligence, migration safety patterns, and integrity patterns. Three-part finding reporting standard enforced. Seven precision fixes from Review Squad audit: cyclomatic complexity formula corrected (bare `else` removed), idempotency pre-check added to Integrity Patterns, quality gates template structured as REJECT/WARN/NOTE, FK REJECT rule scoped (same-schema, non-polymorphic, audit tables exempt), finding reporting standard mode-qualified for consult, role block drive ordering corrected (Quality Absolutist first), thoughtfulness check expanded to full 8-smell taxonomy. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v4.0.html)
>
> **V3.9** — **Design Voice** added to Stevey Boy Choi (all three modes): greenfield/adaptive mode detection, four aesthetic frameworks (hierarchy, tension, rhythm, gestalt), current design vocabulary with shelf-life signals (glassmorphism/claymorphism flagged as dated), craft depth across typography pairing, color theory (temperature contrast + tint stacking), motion choreography (easing + duration contracts), and spatial composition (8px grid + density ladder). Anti-pattern registry enforced in review. **Security Intelligence** added to Jared (all three modes): 12 Tier 1 OWASP Core vectors + 11 Tier 2 advanced vectors (SSRF, JWT algorithm confusion, CSRF, prototype pollution, race conditions, ReDoS, GraphQL attacks, and more), each with exploit path + code signature + hardened fix. Three-part finding standard enforced — no speculative security claims. Security review checklist restructured from 4 generic checks to Tier 1 (8 mandatory) + Tier 2 (10 conditional). Both layers backed by canonical reference files in `agents/_shared/`. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v3.9.html)
>
> **V3.8** — `/debate-false-positive` command: structured 3-round multi-agent debate for false positive stress testing. Introduces the **pre-flight gate system** — mandatory verification checks injected directly into agent prompts before any finding in a category can be raised. 11-run calibration achieved 7/7 expected false positives correctly cleared with 0 phantom claims (up from 1/6 cleared and 5 phantoms at baseline). Core finding: structural intervention in the command prompt overrides behavioral priors more reliably than rules in agent definition files. Emily's phantom scoring definition narrowed to "objectively false claims about the code" — correct-but-out-of-scope concerns no longer count as phantoms. Full calibration methodology in [`docs/superpowers/methodology/`](docs/superpowers/methodology/). — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v3.8.html)
>
> **V3.7** — Agent quality pass derived from experimental multi-agent debate session. Emily: deduplication guard, pre-defined problem fast-track, "wrong direction > visible damage" framing. FC review: cross-agent connections output section. Jared review: proportional threat calibration (scrutiny depth ≠ verdict threshold). Stevey review: chain-citing, invisible-bugs ownership, user-visible impact priority. Nando review: Emily added to squad roster, logical fallacy identification in synthesis, Emily CHALLENGE resolution required. PM Cory: receipts-backed challenges, outcome specificity over generic coordination claims. Cross-cutting: stale copy-paste rules removed from non-implementation agents; parallel execution contradiction resolved across all three technical reviewers; PM Cory memory carve-out fixed in consult and implement modes. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v3.7.html)
>
> **V3.6** — Context monitor hook + GSD removal + audit memory persistence + agent chat. New `review-squad-context-monitor.js` hook warns at 65% context used (WARNING) and 75% (CRITICAL) so you know when to `/compact` before auto-compaction data loss. GSD workflow integration removed — the Review Squad is now a standalone tool with no external dependencies. `/audit` now persists findings to `.review-squad/learnings.jsonl` and `review-history.md` via PM Cory after each audit. All 25 agents can now broadcast to a live chat dashboard via `csend` — use `/agent-chat:on` to start the server and open `http://127.0.0.1:4001` to watch agents in real time. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v3.6.html)
>
> **V3.5** — `/create-agent` — interactively build a custom agent via 5-question Q&A. Pick a template (security, quality, domain expert, docs, performance, or blank), name it, specialise it, pick a tone and tools. Preview before write. Custom agents use a `custom-` prefix so `/update` never overwrites them, and `/quick` dispatches them directly: `/quick <task> custom-{name}`. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v3.5.html)
>
> **V3.4** — `/update` rewritten to use curl. No local clone required: one `curl` installs the command, then `/update` pulls everything from GitHub directly. Version tracking via `~/.claude/review-squad-version`; first run syncs all files, incremental runs sync only what changed. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v3.4.html)
>
> **V3.3** — Context Pre-Loading Protocol. The orchestrator now reads all relevant files once before spawning any agent, injecting contents verbatim into each agent's prompt. Agents that receive pre-loaded context are barred from re-reading those files. In `/review`, 6 agents × N files collapses from 6N reads to 1 orchestrator read pass. All commands updated: `/discuss`, `/research`, `/plan`, `/consult`, `/implement`, `/review`, `/quick`. — [Full changelog →](https://corye-cic.github.io/Review_Squad/changelogs/v3.3.html)

## The Squad

| Agent | Role | Specialties |
|-------|------|-------------|
| **Father Christmas (FC)** | Database admin, backend architect, code quality implementer | Schema design, business logic, data integrity, code craft |
| **Jared** | Full-stack architect, security engineer | Auth, validation, hardening, efficiency, systems reuse |
| **Stevey Boy Choi** | UX/UI designer, frontend implementer, microservices connectivity specialist | Visual polish, accessibility, data pathway efficiency, service integration health |
| **PM Cory** | Program manager, creative challenger, memory agent | Coordination, persistent learnings, cross-agent synthesis |
| **Nando** | Lead architect, squad director | Conflict resolution, implementation briefs, final technical verdict |
| **Emily** | Product manager, validation test designer, final reviewer | Requirements, plan adherence, E2E validation tests, pressure testing, accessibility compliance, UX intent |

## Lifecycle Commands

The squad operates across 7 lifecycle commands plus ad-hoc shortcuts:

```
/discuss  →  /research  →  /plan  →  /consult  →  /implement  →  /review  →  /ship
```

| Command | Purpose | Agents Involved |
|---------|---------|-----------------|
| `/discuss` | Explore the problem space before technical work | Emily (leads), PM Cory |
| `/research` | Investigate patterns, technology options, prior art | Emily (leads), PM Cory |
| `/plan` | Create a structured implementation plan | Emily (leads), PM Cory |
| `/consult` | Design the approach — architecture, interfaces, scope division | FC, Jared, Stevey, PM Cory, Nando |
| `/implement` | Parallel domain-specific coding guided by the Implementation Brief | FC, Jared, Stevey, Emily, PM Cory, Nando |
| `/review` | Post-implementation code review across all specialties (Step 0 pre-flight gates on typecheck/lint/branch; auto-invokes `/handoff` on REVISE/BLOCK when context constrained) | All 6 agents |
| `/review-auto` | Closed-loop auto-fix: runs `/review`, classifies findings by tier + source reviewer, dispatches squad implement agents for NIT/MUST-FIX-SAFE fixes, re-reviews. Iteration cap 2. | FC, Jared, Stevey, PM Cory, Nando (review) + implement agents (fix) |
| `/fleet` | Parallel worktree orchestration — decompose phased spec into shards (max 10), isolated per-worktree Postgres DB, sequential rebase-merge with validation, auto-review on merged range | FC, Jared, Stevey, Nando (implement mode, one per shard) |
| `/ship` | Generate presentation, create PR, monitor CI, auto-fix failures (Step 1b.1 branch assertion + Step 1g commit hygiene) | Emily, PM Cory, Nando |
| `/ui-iterate` | Test-driven theme iteration with Playwright visual regression + axe-core fitness scoring — generates N variants, scores composite (contrast / palette / visual diff / a11y), surfaces top 3 per round | Stevey (implement) |
| `/handoff` | Structured session-state snapshot to `.claude/handoff.md` — branch, PR, last commit, review verdict, validation status, next action | — |
| `/audit` | Deep security, architecture, and systems audit (whole codebase or subsystem) | FC (systems/DB), Jared (security/arch), Nando (synthesis) |
| `/quick` | Ad-hoc agent dispatch — run one or more agents on a short task, no lifecycle required | Domain heuristics (auto-routed) or any combination |
| `/create-agent` | Interactively build a custom agent via Q&A — 6 templates, preview before write | — |
| `/sync-upstream` | Automate squad meta-work sync from `~/.claude/` to the Review_Squad repo (cp → commit → push with auto account switching) | — |
| `/squad-health` | Audit squad installation integrity — agent files, commands, hooks, project-rules, hook wiring, version drift, gh auth | — |
| `/squad-metrics` | Summarize squad usage from telemetry logs — commands invoked, verdicts, auto-fix rounds, fleet shards, per week/month | — |
| `/update-reviewsquad` | Pull the latest Review Squad from GitHub and sync agents, commands, templates, project-rules, squad-patterns, and hooks | — |
| `/debate` | Dynamic debate on any topic — agents auto-assigned positions, 3 rounds, Nando verdicts. Requires agent-chat server. | All 6 agents |
| `/debate-false-positive` | Code review false positive stress test — structured 3-round debate with answer key scoring | FC, Jared, Stevey, PM Cory, Nando, Emily |
| `/agent-chat:on` | Start the agent chat server (ports 4000 + 4001) as a background daemon | — |
| `/agent-chat:off` | Stop the agent chat server if running | — |

You can enter the lifecycle at any point. Smaller tasks can skip straight to `/consult` or `/review`. Use `/quick` for truly ad-hoc work that doesn't need the full lifecycle at all.

## Agent Deep Dives

Each agent has a full deep dive document in [`docs/`](docs/). Below is a summary of each agent's role, modes, and review dimensions.

---

### Father Christmas (FC) — Database Admin, Backend Architect & Code Quality Implementer

> **Full deep dive:** [`docs/father-christmas.md`](docs/father-christmas.md)

FC owns the data layer and holds the quality bar for every line of backend code. Enthusiastic about elegant solutions, uncompromising when standards slip.

**Three drives:** Database authority (schema, queries, migrations, indexes, data integrity), quality absolutist (clean, intentional, well-structured code), creative craftsman (solid fundamentals + elegance where it improves clarity).

#### Modes

| Mode | Output | What FC Does |
|------|--------|-------------|
| Consult | Architecture Brief | Existing systems audit, database design, pattern selection, naming conventions, interface design, quality gates |
| Implement | Business logic, DB ops, models, utilities, types, config | Writes core backend code following SOLID principles; defines shared interfaces for other agents |
| Audit | Systems Audit | Database health, established patterns, dead code/duplication, dependency analysis |
| Review | Quality + Craft scores | Naming, structure, patterns, readability, DRY, modern idioms, elegance, thoughtfulness |

**Review scores:** `Quality: A/B/C/D/F` | `Craft: Creative / Solid / Lazy`

**Blocker rules:** Boyscout Rule fixes in touched files. Never suggests changes that break functionality for aesthetics.

---

### Jared — Full-Stack Architect, Security Engineer & Systems Integrator

> **Full deep dive:** [`docs/jared.md`](docs/jared.md)

Ruthlessly practical and allergic to waste. Sees the whole system end-to-end and finds every place it can break, leak, or slow down. Direct, no-nonsense, honest to the point of bluntness.

**Four principles:** Architecture owner (end-to-end system structure), reuse what exists (best code = code you didn't write), security non-negotiable (baked in, not bolted on), efficiency matters (batched ops, smart caching, no redundant work).

#### Modes

| Mode | Output | What Jared Does |
|------|--------|----------------|
| Consult | Architecture & Security Brief | Architecture proposal, security requirements, efficiency concerns, dependency check, integration points |
| Implement | Auth, validation, API hardening, full-stack glue | Middleware/guards, input sanitization, rate limiting, CORS, secrets management, connecting FC's and Stevey's work |
| Audit | Security & Architecture Audit | Auth flows, injection surfaces, privilege escalation, system boundaries, coupling, duplicate code |
| Review | Security + Efficiency + Reuse scores | Input validation, auth checks, injection vectors, N+1 queries, memory leaks, redundant calls, unused dependencies |

**Review scores:** `Security: PASS/WARN/FAIL` | `Efficiency: PASS/WARN/FAIL` | `Reuse: PASS/WARN/FAIL`

**Security Intelligence (V3.9):** Operates from a 23-vector threat taxonomy — 12 Tier 1 OWASP Core vectors (mandatory every review) + 11 Tier 2 advanced vectors (SSRF, JWT algorithm confusion, CSRF, prototype pollution, ReDoS, GraphQL attacks, and more, applied conditionally by surface area). Three-part finding standard: Vector + Evidence + Fix — no speculative claims. Consult mode surfaces a Threat Surface section in the Architecture Brief. Canonical reference: [`agents/_shared/jared-security-intelligence.md`](agents/_shared/jared-security-intelligence.md).

**Blocker rules:** Confirmed security issues are always blockers. Threat calibration governs scrutiny depth — a public read-only endpoint gets proportional scrutiny, but any confirmed vulnerability blocks regardless of context. Points to EXACT file and function when flagging reuse. Quantifies efficiency impact (O(n^2) vs O(n)).

---

### Stevey Boy Choi — UX/UI Designer, Frontend Implementer & Microservices Connectivity Specialist

> **Full deep dive:** [`docs/stevey-boy-choi.md`](docs/stevey-boy-choi.md)

Laid-back and approachable, but razor sharp. Wears two hats: **Frontend** (activates for frontend files) and **Microservices Connectivity** (always on). Owns everything he touches — if it connects to something, he owns that connection too.

#### Core Principles

| Hat | Principle | What Stevey Checks |
|-----|-----------|-------------------|
| Frontend | **Visual Quality** | Spacing, alignment, typography, color, responsive, hover/focus states, transitions |
| Frontend | **UX Sensibility** | Loading/error/empty/success states, interaction flow, destructive action confirmation |
| Frontend | **Accessibility** | WCAG AA contrast, semantic HTML, ARIA, keyboard nav, focus management, screen readers |
| Connectivity | **Data Pathway Efficiency** | Call chain length, redundant fetches, N+1 across boundaries, payload bloat |
| Connectivity | **Resilience** | Timeouts on every outbound call, idempotent retries, circuit breakers, graceful degradation |
| Connectivity | **Ownership Signals** | Dead connections, undocumented pathways, shared state leaks |

#### Modes

| Mode | Output | What Stevey Does |
|------|--------|-----------------|
| Consult | Design & Connectivity Brief | Component design, interaction flow, visual approach, data flow mapping, call chain audit, failure mode planning |
| Implement | Frontend code + connectivity code | HTML/CSS/JS, components, accessibility, service clients, caching layers, circuit breakers, integration tests |
| Review | 5-dimension ratings | Visual, UX, Performance, Accessibility, Connectivity per file/component/service |

**Design Voice (V3.9):** Greenfield/adaptive mode detection, four aesthetic frameworks (hierarchy, tension, rhythm, gestalt), design vocabulary with shelf-life signals (glassmorphism/claymorphism flagged as dated), craft depth across typography pairing, color theory, motion choreography, and spatial composition. Anti-pattern registry (MUI defaults, hover-only affordances, rainbow palettes, icon-only actions) enforced in review. Canonical reference: [`agents/_shared/stevey-design-principles.md`](agents/_shared/stevey-design-principles.md).

**Review scores:** `Visual: Clean/Decent/Rough` | `UX: Smooth/Okay/Clunky` | `Performance: Fast/Fine/Sluggish` | `Accessibility: Solid/Gaps/Needs Work` | `Connectivity: Clean/Redundant/Fragile` | `Design vocab: Current/Dated/Flagged` | `Anti-patterns: None/Present/Blocking`

**Blocker rules:** Accessibility failures that prevent operation. Redundant service calls that double latency. Missing timeouts on service-to-service calls — every time. MUI defaults without customization always flagged.

---

### PM Cory — Program Manager, Creative Challenger & Persistent Memory Agent

> **Full deep dive:** [`docs/pm-cory.md`](docs/pm-cory.md)

Wide-eyed newcomer with fresh perspective, relentless curiosity, and sharp PM instincts. The only agent with persistent memory — learnings, patterns, and codebase knowledge survive across sessions in `.review-squad/<project-name>/`.

**Three capabilities:** Creative challenger (questions everything, bounces ideas across agents, champions creative solutions), program manager (ensures completeness, removes blockers, synthesizes across agents), persistent memory agent (institutional knowledge that compounds over time).

#### Modes

| Mode | Output | What Cory Does |
|------|--------|---------------|
| Consult | Consultation Notes | Loads context, surfaces history, challenges approach, identifies scope boundaries, flags coordination risks |
| Implement | Coordination (no application code) | Ensures lane discipline, manages shared interfaces, resolves file conflicts, tracks progress, persists learnings |
| Review | Creative Challenge + PM Status + Memory Update | Probing questions, reviewer coverage check, cross-agent connections, memory persistence |
| Present | Developer-facing JSON | Files changed, test results, architecture notes, review verdict, risks mitigated |

**Memory files:** `codebase-map.md`, `learnings.jsonl`, `patterns.md`, `review-history.md`, `agent-notes/<agent>.md`

**Compounding value:** By the third review cycle, the squad knows the project's conventions, recurring issues, and established patterns.

---

### Nando — Lead Architect & Squad Director

> **Full deep dive:** [`docs/nando.md`](docs/nando.md)

Calm, authoritative, fair. Consolidates four specialist opinions into one clear direction. Produces the Implementation Brief (binding contract for parallel work) and the final consolidated review verdict.

#### Modes

| Mode | Output | What Nando Does |
|------|--------|----------------|
| Consult | **Implementation Brief** | Resolves conflicts, validates scope, defines shared interfaces, sets wave order, produces the binding brief |
| Implement | Oversight report | Spot-checks agent output, resolves integration conflicts, approves deviations, writes integration glue, validates Emily's tests |
| Review | **Consolidated Verdict** | Reads all reviews, pressure-tests findings, synthesizes into tiered output |

**Implementation Brief sections:** Architecture decision, Wave 1/2 scope assignments, shared interfaces with exact type signatures, security requirements, quality gates, UX/connectivity requirements, conflict resolutions, coordination notes.

**Review tiers:** Blockers > Required Changes > Recommended Improvements > Boyscout Fixes > Highlights

**Verdict:** APPROVE / CONDITIONAL APPROVE / REVISE / BLOCK

**Hard rules:** Never overrides Jared's security failures or Stevey's accessibility blockers without personal verification. If Emily issues a CHALLENGE against an APPROVE verdict, addresses it in Reviewer Disagreements — does not let it pass to the user unaddressed. Identifies reasoning fallacies in agent findings (importance-by-catastrophe, conflating criticality with contribution). Prioritizes ruthlessly. Resolves contradictions explicitly. If all agents approve clean, doesn't invent problems.

---

### Emily — Product Manager, Validation Test Designer & Final Reviewer

> **Full deep dive:** [`docs/emily.md`](docs/emily.md)

Calm authority with deep experience in requirements engineering and strategic planning. Leads the early phases (Discuss, Research, Plan), designs validation tests during Implementation, and performs the final review after Nando's verdict. Strong creative streak and unwavering accessibility champion.

#### Modes (6 — most of any agent)

| Mode | Output | What Emily Does |
|------|--------|----------------|
| Discuss (leads) | Discussion Summary | Problem framing, requirements (must/should/nice-to-have), success criteria, accessibility requirements, UX vision, open questions |
| Research (leads) | Research Findings | Codebase patterns, technology evaluation with a11y implications, prior art, risk identification, clear recommendation |
| Plan (leads) | Implementation Plan | Phased deliverables with a11y woven in, scope boundaries, UX validation points, risk mitigations, success validation |
| Implement | Validation Test Plan | Playwright E2E tests (preferred), framework tests, manual checklists, pressure tests — all mapped to success criteria |
| Review (final) | Plan Adherence Review | Plan adherence, research alignment, requirements coverage, a11y compliance, UX intent, E2E test results, pressure test results |
| Present | Stakeholder-facing JSON | Headline, summary, capabilities (new/enhanced/fixed), before/after, impact, accessibility notes |

**Review verdict:** CONFIRM / CHALLENGE

- **CONFIRM** — Implementation aligns. Nando's verdict stands.
- **CHALLENGE** — Specific items need attention. Explains why each matters.

**Blocker rules:** Accessibility failures are blockers (same weight as Stevey's). Test failures carry the same weight as plan adherence issues. If plan was skipped, notes the gap explicitly.

---

## How It Works

### Review (`/review`)
Spawns FC, Jared, Stevey, PM Cory in parallel. The orchestrator pre-loads all changed file contents before spawning any agent — each agent receives an `<injected-context>` block and is barred from re-reading those files. Stevey's frontend hat activates for frontend files; his connectivity hat is always on. Nando then synthesizes all findings into a consolidated verdict (APPROVE / REVISE / BLOCK). Emily performs the final review checking plan adherence, accessibility, and UX intent (CONFIRM / CHALLENGE).

### Consultation (`/consult`)
Each agent analyzes the task from their domain — FC proposes architecture, Jared audits security and existing systems, Stevey designs UI components and maps data connectivity, PM Cory loads prior learnings and challenges assumptions. Nando resolves conflicts and produces an **Implementation Brief** with wave structure, scope assignments, and shared interfaces.

### Implementation (`/implement`)
Agents execute the brief in waves. Wave 1 builds foundations (data models, auth, shared types). Wave 2 runs in parallel once interfaces are defined. PM Cory coordinates, tracks progress, and resolves file conflicts. Nando spot-checks integration.

### Ship (`/ship`)
Enforces a review gate (requires APPROVE + CONFIRM). Emily generates stakeholder-facing content (headline, summary, capabilities, before/after). PM Cory generates developer-facing content (files changed, test results, architecture notes, review verdict). The orchestrator assembles a self-contained HTML presentation, creates a PR, monitors CI inline (~5 min), and falls back to an async watcher script for slow pipelines. Failed CI checks are auto-routed to FC and/or Jared for resolution (max 3 attempts).

## Workflow Guide

### The Full Lifecycle

The squad is designed around a linear lifecycle. Each phase feeds the next. The full flow looks like this:

```
/discuss  →  /research  →  /plan  →  /consult  →  /implement  →  /review  →  /ship
   │             │            │           │             │             │          │
   │             │            │           │             │             │          └─ PR + CI + presentation
   │             │            │           │             │             └─ 6-agent code review
   │             │            │           │             └─ Parallel coding by FC/Jared/Stevey
   │             │            │           └─ Architecture brief with scope assignments
   │             │            └─ Structured implementation plan
   │             └─ Technology research + prior art
   └─ Problem exploration + requirements
```

**Each phase produces artifacts that the next phase consumes.** Emily's plan feeds into Nando's implementation brief. The brief assigns scope to each agent during implementation. The review squad checks the implementation against the plan. `/ship` gates on review approval.

### When to Use the Full Flow

**Use all 7 phases when:**
- Building a significant feature (multiple files, multiple agents' domains)
- Working in an unfamiliar codebase where research matters
- The feature has UX, security, and data layer implications
- Stakeholders need a presentation of what shipped

### When to Skip Phases

Not every task needs all 7 phases. Here's how to shortcut efficiently:

| Task Size | Start At | Skip |
|-----------|----------|------|
| **Ad-hoc task** (quick fix, focused question, one-shot review) | `/quick` | Everything — no lifecycle needed |
| **Bug fix** (1-3 files) | Write the fix yourself, then `/review` | Everything before review |
| **Small feature** (3-10 files, single domain) | `/consult` → `/implement` → `/review` | discuss, research, plan |
| **Medium feature** (10+ files, multiple domains) | `/plan` → `/consult` → `/implement` → `/review` | discuss, research |
| **Large feature** (new system, multiple services) | Full flow starting at `/discuss` | Nothing |
| **Quick review of existing changes** | `/review` directly | Everything else |
| **Ship after manual implementation** | `/review` → `/ship` | Everything before review |

**Rule of thumb:** If you already know what to build and how, skip to `/consult`. If you know the architecture but need the squad to write it, skip to `/implement` with a brief. If you just want a quality check, go straight to `/review`.

### Phase-by-Phase: What Happens and What You Do

#### `/discuss` — Problem Exploration
**You provide:** A description of what you want to build or the problem to solve.
**Emily does:** Asks structured questions one at a time to understand requirements, constraints, success criteria, and edge cases. Pushes back on vague requirements.
**PM Cory does:** Loads prior learnings, challenges assumptions, surfaces relevant history.
**You get:** A clear problem definition and requirements summary saved to `.review-squad/<project>/current-discussion.md`.

**Tip:** Don't skip this for complex features. 10 minutes of discussion saves hours of rework when the squad builds the wrong thing.

#### `/research` — Technology & Pattern Research
**You provide:** Nothing extra — it reads the discussion output.
**Emily does:** Investigates technology options, existing patterns in the codebase, prior art, and alternative approaches. Produces a research summary with recommendations.
**You get:** Research findings saved to `.review-squad/<project>/current-research.md`.

**Tip:** Most useful when you're integrating with unfamiliar APIs, choosing between libraries, or building something the codebase doesn't have a pattern for yet. Skip for routine features.

#### `/plan` — Implementation Planning
**You provide:** Nothing extra — it reads discussion and research outputs.
**Emily does:** Creates a structured implementation plan with phases, file assignments, success criteria, accessibility requirements, and risk assessment.
**You get:** A plan saved to `.review-squad/<project>/current-plan.md`.

**Tip:** The plan is what Emily checks against during her final review. If you skip `/plan`, Emily does a lighter-touch review focused only on accessibility and UX intent.

#### `/consult` — Architecture & Scope Division
**You provide:** A task description, or nothing if a plan already exists (it loads automatically).
**The squad does:**
- **FC** proposes architecture, data models, naming, interfaces
- **Jared** audits existing systems, defines security requirements, plans DB changes
- **Stevey** designs UI components + maps microservice data flows
- **PM Cory** loads prior learnings, challenges assumptions, proposes scope division
- **Nando** resolves conflicts and produces the **Implementation Brief**

**You get:** An Implementation Brief with wave structure, per-agent scope, shared interfaces, and quality gates. Saved to `.review-squad/<project>/current-brief.md`.

**Tip:** Read the brief before running `/implement`. If the scope division doesn't look right, modify it. The brief is the contract the agents follow.

#### `/implement` — Parallel Agent Coding
**You provide:** Nothing extra — it loads the brief automatically.
**The squad does:**
- **Wave 1** runs first (foundations — data models, auth, shared types). Typically FC and Jared.
- **Wave 2** runs in parallel after Wave 1 interfaces are verified. All assigned agents.
- **Emily** designs validation tests in parallel with Wave 2 — Playwright E2E tests if installed, automated + manual test checklists otherwise. Tests map to every success criterion from the plan.
- **PM Cory** coordinates, manages interfaces between agents, resolves file conflicts.
- **Nando** spot-checks integration after all waves complete, including verifying Emily's tests reference real implementation.

**You get:** Working code committed atomically by each agent, validation tests ready for `/review`, plus an integration report.

**Tip:** The brief guarantees no two agents touch the same file in the same wave. Emily writes only to the test directory — no conflict with implementation agents.

#### `/review` — 6-Agent Code Review + E2E Feature Validation
**You provide:** File paths, a git ref, or nothing (reviews all uncommitted changes).
**The squad does:**
- **FC** reviews for code quality, design, patterns
- **Jared** reviews for security, efficiency, reuse
- **Stevey** reviews for frontend quality (if applicable) AND microservice connectivity (always)
- **PM Cory** loads context, challenges assumptions, cross-links findings, persists learnings
- **Nando** synthesizes all findings → **APPROVE / REVISE / BLOCK**
- **Emily** runs E2E validation tests (Playwright/automated + manual checklists), executes pressure test scenarios, checks plan adherence, accessibility, UX intent → **CONFIRM / CHALLENGE**. Test failures carry the same weight as plan adherence issues.

**You get:** A consolidated verdict with required changes (if any), plus E2E test results with pass/fail evidence per feature. Fix and re-run `/review` until APPROVE + CONFIRM.

**Tip:** The hook auto-suggests `/review` at natural wrap-up points (commit, test run, 5+ files edited). You don't have to remember to run it.

#### `/ship` — PR + Presentation + CI
**You provide:** An optional PR title/description, or nothing (Emily infers from commits).
**The squad does:**
- **Gates** on APPROVE + CONFIRM from the latest review
- **Emily** generates stakeholder-facing JSON (headline, summary, capabilities, before/after)
- **PM Cory** generates developer-facing JSON (files, tests, architecture, verdict)
- **Orchestrator** assembles a self-contained HTML presentation
- **Creates PR** with meaningful body derived from agent content
- **Monitors CI** inline (~5 min), falls back to async watcher for slow pipelines
- **Auto-fixes** CI failures by routing to FC/Jared (max 3 attempts)

**You get:** A merged-ready PR, an HTML presentation in `.review-squad/<project>/presentations/`, and green CI (or a clear escalation if auto-fix fails).

#### `/quick` — Ad-hoc Agent Dispatch
**You provide:** A task description, and optionally which agents to involve and their modes.
**The squad does:**
- **No agents specified** — inline domain heuristics pick the single best-fit agent and mode, fires immediately. Maximum two agents if the task genuinely spans two separable domains.
- **Agents without modes** — each named agent runs a lightweight pre-flight (MODE/RELEVANCE/REASON). Only high-relevance agents proceed. You confirm before work begins.
- **Agents with explicit modes** (e.g. `fc:implement,jared:review`) — fires immediately, no pre-flight, no confirmation.
- **`+nando` flag** — after primary agents complete, Nando synthesizes all outputs into a consolidated verdict.

**Syntax:**
```
/quick <task description>                             # auto-routed via domain heuristics
/quick <task description> fc,jared                    # self-select pre-flight
/quick <task description> fc:implement,jared:review   # explicit — fires immediately
/quick <task description> stevey,fc +nando            # self-select + Nando synthesis
/quick <task description> custom-{name}               # dispatch a custom agent directly
/quick <task description> custom-{name},jared:review  # custom agent + squad agent (squad must have :mode)
```

**Agent aliases:** `fc` (Father Christmas), `jared`, `stevey` (Stevey Boy Choi), `cory` (PM Cory), `nando`, `emily`

**You get:** Agent output(s) in `=== AGENT (mode) ===` format, plus Nando's synthesis if `+nando` was specified. No `.review-squad/` artifacts written.

**Tip:** `/quick` is the zero-ceremony option. No plan, no brief, no persistent memory updates. Use it for focused questions, quick fixes, or spot checks where the full lifecycle would be overkill.

### Custom Agents

Create your own agents tailored to your project's domain using `/create-agent`. Custom agents live at `~/.claude/agents/custom-{name}.md` and are dispatched via `/quick` like any squad agent.

```
/create-agent
```

The command walks you through 5 questions:
1. **Template** — security reviewer, code quality, domain expert, documentation, performance, or blank
2. **Name** — becomes `custom-{name}.md`; validated lowercase/hyphens only
3. **Specialization** — what the agent focuses on (e.g. "PCI DSS compliance", "React Query patterns")
4. **Tone** — direct/blunt, collaborative, formal, or neutral
5. **Tools** — defaults from template; any of Read, Write, Edit, Bash, Grep, Glob

Shows a full preview before writing anything. `/update` never overwrites `custom-` agents.

**Example:**
```
/quick review the payments module for PCI compliance issues custom-payments-expert
```

### Efficiency Tips

1. **Don't re-run phases unnecessarily.** Each phase saves its output. If you already ran `/discuss` and `/research`, jumping to `/plan` will pick them up automatically.

2. **The review hook is your friend.** It fires when you're about to commit or run tests. Let it remind you instead of tracking review timing yourself.

3. **Fix and re-review, don't argue.** If the squad says REVISE, fix the items and re-run `/review`. Each round gets faster as prior findings are resolved. Most features pass in 1-2 rounds.

4. **Use `/review` with file paths for focused reviews.** `/review src/auth.ts src/middleware.ts` is faster than reviewing everything when you only changed two files.

5. **PM Cory's memory compounds.** The more you use the squad on a project, the smarter it gets. Cory persists learnings, patterns, and anti-patterns across sessions. By the third review cycle, the squad knows your project's conventions.

6. **Stevey always participates now.** Even pure backend changes get a connectivity review. If your services talk to each other, Stevey is checking those pathways.

7. **`/ship` is a commitment.** It pushes code, creates PRs, and auto-fixes CI. Only invoke it when you're ready to go to remote. Everything before `/ship` is local-only.

8. **The orchestrator reads, agents execute.** As of V3.3, every command pre-loads file contents before spawning agents. Agents work from injected context, not independent file reads. This cuts redundant token spend — especially on `/review` where all 6 agents previously read the same files independently.

---

## Persistent Memory

PM Cory maintains squad memory in `.review-squad/<project-name>/`:

| File | Purpose |
|------|---------|
| `codebase-map.md` | Living architecture map updated each review cycle |
| `learnings.jsonl` | Append-only log of findings (one JSON object per line) |
| `patterns.md` | Project patterns to follow and anti-patterns to flag |
| `review-history.md` | Summary of past reviews with verdicts and findings |
| `agent-notes/<agent>.md` | Per-agent knowledge files for cross-session context |

This directory is gitignored — it's local session state, not portable.

## Review Squad Gate (Hook)

Two PostToolUse hooks ship with the squad:

**`hooks/review-squad-gate.js`** monitors coding sessions and suggests running the review squad at natural wrap-up points:
- Fires on git commit/add, test runner invocation, or 5+ files edited followed by a build command
- 10-minute debounce between advisories
- Detects `pr-failure.md`, `pr-success.md`, and `pr-timeout.md` from the async watcher and surfaces them in the next session

**`hooks/review-squad-context-monitor.js`** warns when the context window approaches limits:
- **WARNING** at 65% used (35% remaining) — suggests `/compact Focus on [active feature]`
- **CRITICAL** at 75% used (25% remaining) — urgent prompt to compact before auto-compaction causes data loss
- Debounces per 5 tool uses per threshold so it doesn't nag
- Requires `review-squad-statusline.js` to be configured as your `statusLine` (it writes the bridge file that the monitor reads)

**`hooks/review-squad-statusline.js`** is the companion statusline that feeds context data to the monitor:
- Displays model, working directory, and a context usage bar in the status line
- Writes `/tmp/claude-ctx-{session_id}.json` on every render so the context monitor can read it
- Configure as your `statusLine` in `~/.claude/settings.json` — see Installation for details

## Installation

### Prerequisites
- [Claude Code CLI](https://claude.com/claude-code) with Agent tool support
- Node.js 18+
- `gh` CLI (for `/ship` PR creation and CI monitoring)
- `jq` (for the async watcher script)

### Option A — Plugin install (V4.2+, recommended)

```bash
claude plugin add Corye-CIC-Review-Squad github:Corye-CIC/Review_Squad
claude plugin install Review_Squad@Corye-CIC-Review-Squad
```

This installs all agents, commands, hooks, templates, project-rules, and squad-patterns automatically. After install, wire the four hooks into `~/.claude/settings.json` (see step 4 below) and run `/squad-health` to verify.

### Option B — Manual setup (pre-V4.2 method)

1. Copy agent definitions to your Claude config:
   ```bash
   cp agents/*.md ~/.claude/agents/
   ```

2. Copy commands:
   ```bash
   cp commands/*.md ~/.claude/commands/
   ```

3. Copy the HTML template:
   ```bash
   mkdir -p ~/.claude/templates
   cp templates/ship-presentation.html ~/.claude/templates/
   ```

4. Install the hooks — add both to your `.claude/settings.json` under `hooks.PostToolUse`:
   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "node /path/to/hooks/review-squad-context-monitor.js"
             }
           ]
         },
         {
           "hooks": [
             {
               "type": "command",
               "command": "node /path/to/hooks/review-squad-gate.js"
             }
           ]
         }
       ]
     }
   }
   ```

5. Ensure `.review-squad/` is in your project's `.gitignore`.

### Staying Up to Date

Install the `/update-reviewsquad` command once:

```bash
curl -sf "https://raw.githubusercontent.com/Corye-CIC/Review_Squad/main/commands/update-reviewsquad.md" \
  -o ~/.claude/commands/update-reviewsquad.md
```

Then run `/update-reviewsquad` in Claude Code any time to sync the latest agents, commands, templates, and hooks from GitHub — no local clone required.

## Repository Structure

```
agents/                            # Mode-specific agent files (25 files)
  _shared/
    rules.md                       #   Shared rules reference (inlined in each file)
  emily-discuss.md                 #   Emily — discuss mode
  emily-research.md                #   Emily — research mode
  emily-plan.md                    #   Emily — plan mode
  emily-implement.md               #   Emily — implement mode (validation test design)
  emily-review.md                  #   Emily — final review mode
  emily-present.md                 #   Emily — stakeholder presentation mode
  father-christmas-consult.md      #   FC — consult mode
  father-christmas-implement.md    #   FC — implement mode
  father-christmas-audit.md        #   FC — audit mode
  father-christmas-review.md       #   FC — review mode
  jared-consult.md                 #   Jared — consult mode
  jared-implement.md               #   Jared — implement mode
  jared-audit.md                   #   Jared — audit mode
  jared-review.md                  #   Jared — review mode
  nando-consult.md                 #   Nando — consult mode
  nando-implement.md               #   Nando — implement mode
  nando-review.md                  #   Nando — review mode
  pm-cory-early.md                 #   PM Cory — discuss/research/plan (consolidated)
  pm-cory-consult.md               #   PM Cory — consult mode
  pm-cory-implement.md             #   PM Cory — implement mode
  pm-cory-review.md                #   PM Cory — review mode
  pm-cory-present.md               #   PM Cory — developer presentation mode
  stevey-boy-choi-consult.md       #   Stevey — consult mode
  stevey-boy-choi-implement.md     #   Stevey — implement mode
  stevey-boy-choi-review.md        #   Stevey — review mode
commands/                          # Lifecycle commands + extensions + utilities
  discuss.md                       #   Problem exploration
  research.md                      #   Pattern and technology research
  plan.md                          #   Implementation planning
  consult.md                       #   Pre-implementation consultation
  implement.md                     #   Parallel agent implementation
  review.md                        #   Full squad code review (Step 0 pre-flight gate)
  review-auto.md                   #   Closed-loop auto-fix via squad implement agents (V4.2)
  ship.md                          #   Presentation, PR, CI monitoring (branch + hygiene gates)
  fleet.md                         #   Parallel worktree orchestration (V4.2)
  ui-iterate.md                    #   Test-driven theme iteration with fitness scoring (V4.2)
  handoff.md                       #   Structured session-state snapshot (V4.2)
  audit.md                         #   Deep security, architecture, and systems audit
  quick.md                         #   Ad-hoc agent dispatch (supports custom agents)
  create-agent.md                  #   Interactive custom agent builder
  sync-upstream.md                 #   Automate squad meta-work sync to upstream (V4.2)
  update-reviewsquad.md            #   Sync latest squad from GitHub via curl
  agent-chat/
    on.md                          #   Start the agent chat server as a background daemon
    off.md                         #   Stop the agent chat server
  debate.md                        #   Dynamic topic debate (any topic, auto-assigned positions)
  debate-false-positive.md         #   Code review false positive stress test
project-rules/                     # Opt-in per-project rules (V4.2)
  commit-hygiene.md                #   72-char body, prettier before stage, stale imports
  dev-environment.md               #   Worktree + port + env var discipline
squad-patterns/                    # Cross-project pattern library (V4.2)
  recurring-blockers.md            #   Blocker classes with plan/review-time checks (Tier A)
  tooling-patterns.md              #   Agent-orchestration-specific patterns (Tier B)
  verdict-trends.md                #   Verdict distribution by project type
  auto-fix-patterns.md             #   /review-auto classification rules
.claude-plugin/                    # Plugin manifest (V4.2)
  plugin.json                      #   Plugin metadata + install destinations
  marketplace.json                 #   Marketplace entry for plugin discovery
hooks/
  review-squad-gate.js             # PostToolUse hook — review advisory at wrap-up points (V4.2 skip logic)
  review-squad-context-monitor.js  # PostToolUse hook — context window WARNING/CRITICAL alerts
  review-squad-statusline.js       # statusLine hook — context bar + bridge file for monitor
  squad-telemetry.js               # PostToolUse hook — squad usage telemetry → jsonl per project (V4.2)
templates/
  ship-presentation.html           # Self-contained HTML reference template
services/
  agent-chat/                      # Agent chat dashboard server
    debate.js                      #   General-purpose debate orchestrator (node debate.js "<topic>")
  chat-bridge/                     # Bridge between agents and chat server
docs/
  emily.md                         # Agent deep dive — Emily
  father-christmas.md              # Agent deep dive — FC
  jared.md                         # Agent deep dive — Jared
  nando.md                         # Agent deep dive — Nando
  pm-cory.md                       # Agent deep dive — PM Cory
  stevey-boy-choi.md               # Agent deep dive — Stevey
  superpowers/specs/               # Design specifications
```

## License

Private — internal use.
