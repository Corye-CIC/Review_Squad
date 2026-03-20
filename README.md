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
| **Emily** | Product manager, final reviewer | Requirements, plan adherence, accessibility compliance, UX intent |

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
| `/implement` | Parallel domain-specific coding guided by the Implementation Brief | FC, Jared, Stevey, PM Cory, Nando |
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
  stevey-boy-choi.md     #   UX/UI designer, frontend implementer
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
