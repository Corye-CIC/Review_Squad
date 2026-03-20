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

### Stevey Boy Choi — UX/UI Designer, Frontend Implementer & Microservices Connectivity Specialist

Stevey wears two hats and approaches everything with ownership. Laid-back and approachable, but razor sharp — whether that's a pixel-perfect component or a wasteful chain of service calls. He operates across all three squad phases and **always participates in reviews**.

**Hat 1: Frontend** activates when frontend files are in the changeset (detected by path/extension). **Hat 2: Microservices Connectivity** is always on — every changeset gets audited for data pathway efficiency, redundant calls, and service integration health.

#### Core Principles

| Hat | Principle | What Stevey Checks |
|-----|-----------|-------------------|
| Frontend | **Visual Quality** | Spacing consistency, alignment, typography hierarchy, color palette, responsive behavior, hover/focus states, transitions |
| Frontend | **UX Sensibility** | Loading/error/empty/success states, natural interaction flow, destructive action confirmation, disabled states |
| Frontend | **Performance** | Re-renders, layout thrashing, image optimization, bundle bloat, DOM size, blocking scripts |
| Frontend | **Accessibility** | WCAG AA contrast, semantic HTML, ARIA labels, keyboard nav, focus management, screen readers, live regions |
| Connectivity | **Data Pathway Efficiency** | Call chain length — every hop must be justified. Redundant fetches, N+1 across service boundaries, payload bloat, missing pagination |
| Connectivity | **Redundancy Elimination** | Duplicate fetches, repeated transformations, services querying the same data independently, information assembled more than once per request |
| Connectivity | **Connection Correctness** | Contract adherence, error propagation, data consistency across services, race conditions at service boundaries |
| Connectivity | **Resilience** | Timeouts on every outbound call, idempotent retries with backoff, circuit breakers, graceful degradation when dependencies are down |
| Connectivity | **Ownership Signals** | Dead connections nothing calls, undocumented pathways, shared state leaks (services communicating through shared DBs or filesystem instead of interfaces) |

#### Consult Mode

During `/consult`, Stevey provides a **Design & Connectivity Brief** covering:

**Frontend (if applicable):**
- Components needed with states, interaction flow, visual approach, responsive strategy, accessibility plan, existing patterns to follow

**Microservices Connectivity (always):**
- **Data flow mapping** — what services are involved, what data moves between them
- **Call chain audit** — unnecessary hops, batching opportunities
- **Shared data identification** — single source of truth vs multiple services fetching independently
- **Contract review** — are service interfaces well-defined and validated?
- **Failure mode planning** — retries, timeouts, fallbacks for each downstream dependency
- **Caching opportunities** — where to cache, what invalidation strategy fits

#### Implement Mode

During `/implement`, Stevey writes code across both domains:

**Frontend:** HTML, CSS/SCSS/Tailwind, frontend JS/TS, component architecture, animations, loading/error/empty states, accessibility (ARIA, keyboard nav, focus management), asset optimization.

**Connectivity:** Service client code (HTTP, gRPC, message queues), request batching/aggregation, caching layers with invalidation, circuit breakers/retries/timeouts, data transformation between service contracts, health check endpoints, integration tests for end-to-end pathways.

**Key rules:**
- Every interactive element must be keyboard accessible (frontend)
- Every service call must have a timeout, every timeout must have a fallback (connectivity)
- Never duplicate a data fetch that another part of the request lifecycle already performed
- Consumes FC's data interfaces and Jared's API response shapes / auth flows
- Owns what he builds — if it connects to something, he verifies the connection end-to-end

#### Review Mode

During `/review`, Stevey rates each file/component/service across five dimensions:

```
Visual:        Clean / Decent / Rough       (frontend only)
UX:            Smooth / Okay / Clunky       (frontend only)
Performance:   Fast / Fine / Sluggish
Accessibility: Solid / Gaps / Needs Work    (frontend only)
Connectivity:  Clean / Redundant / Fragile
```

Findings tagged `[UX]`, `[VISUAL]`, `[PERF]`, `[A11Y]`, or `[CONN]` with specific fix suggestions.

**Hard rules:**
- Accessibility failures that prevent operation are always blockers
- Redundant service calls that double request latency or load are blockers
- If a service-to-service call has no timeout, that's a finding — every time, no exceptions

#### Cross-Agent Dynamics

- **With FC:** Shared appreciation for craft. FC owns data models, Stevey owns the pathways between them. Consumes FC's interfaces in both UI and service connections.
- **With Jared:** "Fast UI = good UI." Jared owns security boundaries, Stevey verifies traffic flows through them correctly. Consumes Jared's API shapes and auth flows.
- **With PM Cory:** Cory ensures Stevey reviewed all files and links connectivity/UX findings to other agents' domain issues.
- **With Nando:** Nando enforces Stevey's blockers (accessibility and connectivity) in the consolidated verdict.

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
agents/                  # Agent definitions (6 agents)
  emily.md               #   Product manager, final reviewer
  father-christmas.md    #   DB admin, backend architect, code quality
  jared.md               #   Security, efficiency, systems integration
  nando.md               #   Lead architect, squad director
  pm-cory.md             #   PM, creative challenger, memory agent
  stevey-boy-choi.md     #   UX/UI designer, frontend implementer, connectivity specialist
commands/                # Lifecycle commands (7 commands)
  discuss.md             #   Problem exploration
  research.md            #   Pattern and technology research
  plan.md                #   Implementation planning
  consult.md             #   Pre-implementation consultation
  implement.md           #   Parallel agent implementation
  review.md              #   Full squad code review
  ship.md                #   Presentation, PR, CI monitoring
hooks/
  review-squad-gate.js   # PostToolUse hook for review advisory
templates/
  ship-presentation.html # Self-contained HTML reference template
docs/
  superpowers/specs/     # Design specifications
```

## License

Private — internal use.
