# Review Squad — Claude Code Sub-Agents

A 6-agent review and development squad for [Claude Code](https://claude.com/claude-code). The squad covers the full development lifecycle from discussion through shipping, with specialized agents handling code quality, security, UX, program management, architectural oversight, and product management.

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

The squad operates across 7 commands that form a complete development lifecycle:

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
| `/review` | Post-implementation code review across all specialties | All 6 agents |
| `/ship` | Generate presentation, create PR, monitor CI, auto-fix failures | Emily, PM Cory, Nando |

You can enter the lifecycle at any point. Smaller tasks can skip straight to `/consult` or `/review`. The full flow is recommended for significant features.

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

**Blocker rules:** Security issues are always blockers — no exceptions. Points to EXACT file and function when flagging reuse. Quantifies efficiency impact (O(n^2) vs O(n)).

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

**Review scores:** `Visual: Clean/Decent/Rough` | `UX: Smooth/Okay/Clunky` | `Performance: Fast/Fine/Sluggish` | `Accessibility: Solid/Gaps/Needs Work` | `Connectivity: Clean/Redundant/Fragile`

**Blocker rules:** Accessibility failures that prevent operation. Redundant service calls that double latency. Missing timeouts on service-to-service calls — every time.

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

**Verdict:** APPROVE / REVISE / BLOCK

**Hard rules:** Never overrides Jared's security failures or Stevey's accessibility blockers without personal verification. Prioritizes ruthlessly. Resolves contradictions explicitly. If all agents approve clean, doesn't invent problems.

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
Spawns FC, Jared, Stevey, PM Cory in parallel. Each agent reads every changed file and reviews from their specialty. Stevey's frontend hat activates for frontend files; his connectivity hat is always on. Nando then synthesizes all findings into a consolidated verdict (APPROVE / REVISE / BLOCK). Emily performs the final review checking plan adherence, accessibility, and UX intent (CONFIRM / CHALLENGE).

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

### Efficiency Tips

1. **Don't re-run phases unnecessarily.** Each phase saves its output. If you already ran `/discuss` and `/research`, jumping to `/plan` will pick them up automatically.

2. **The review hook is your friend.** It fires when you're about to commit or run tests. Let it remind you instead of tracking review timing yourself.

3. **Fix and re-review, don't argue.** If the squad says REVISE, fix the items and re-run `/review`. Each round gets faster as prior findings are resolved. Most features pass in 1-2 rounds.

4. **Use `/review` with file paths for focused reviews.** `/review src/auth.ts src/middleware.ts` is faster than reviewing everything when you only changed two files.

5. **PM Cory's memory compounds.** The more you use the squad on a project, the smarter it gets. Cory persists learnings, patterns, and anti-patterns across sessions. By the third review cycle, the squad knows your project's conventions.

6. **Stevey always participates now.** Even pure backend changes get a connectivity review. If your services talk to each other, Stevey is checking those pathways.

7. **`/ship` is a commitment.** It pushes code, creates PRs, and auto-fixes CI. Only invoke it when you're ready to go to remote. Everything before `/ship` is local-only.

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

`hooks/review-squad-gate.js` is a PostToolUse hook that monitors coding sessions and suggests running the review squad at natural wrap-up points:

- **GSD mode:** Fires on phase completion commits
- **Standard mode:** Fires on git commit/add, test runner invocation, or 5+ files edited followed by a build command
- **Debounce:** 10-minute cooldown between advisories
- **PR monitoring:** Detects `pr-failure.md`, `pr-success.md`, and `pr-timeout.md` from the async watcher and surfaces them in the next session

## Installation

### Prerequisites
- [Claude Code CLI](https://claude.com/claude-code) with Agent tool support
- Node.js 18+
- `gh` CLI (for `/ship` PR creation and CI monitoring)
- `jq` (for the async watcher script)

### Setup

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

4. Install the hook — add to your `.claude/settings.json` under `hooks.PostToolUse`:
   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "",
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
commands/                          # Lifecycle commands (7 commands)
  discuss.md                       #   Problem exploration
  research.md                      #   Pattern and technology research
  plan.md                          #   Implementation planning
  consult.md                       #   Pre-implementation consultation
  implement.md                     #   Parallel agent implementation
  review.md                        #   Full squad code review
  ship.md                          #   Presentation, PR, CI monitoring
hooks/
  review-squad-gate.js             # PostToolUse hook for review advisory
templates/
  ship-presentation.html           # Self-contained HTML reference template
services/
  agent-chat/                      # Agent chat dashboard server
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
