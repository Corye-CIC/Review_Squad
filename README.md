# Review Squad — Claude Code Sub-Agents

A 6-agent review and development squad for [Claude Code](https://claude.com/claude-code). The squad covers the full development lifecycle from discussion through shipping, with specialized agents handling code quality, security, UX, program management, architectural oversight, and product management.

## The Squad

| Agent | Role | Specialties |
|-------|------|-------------|
| **Father Christmas (FC)** | Database admin, backend architect, code quality implementer | Schema design, business logic, data integrity, code craft |
| **Jared** | Full-stack architect, security engineer | Auth, validation, hardening, efficiency, systems reuse |
| **Stevey Boy Choi** | UX/UI designer, frontend implementer | Visual polish, accessibility, responsive design, performance |
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

### Stevey Boy Choi — UX/UI Designer & Frontend Implementer

Stevey is the squad's frontend specialist. Laid-back and approachable, but razor sharp on design quality and accessibility. He operates across all three squad phases: consultation, implementation, and review.

**Stevey only activates when frontend files are in the changeset.** The `/review` and `/implement` commands detect frontend files by path (`frontend/`, `src/components/`, `src/pages/`, `public/`) and extension (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`). If no frontend files are present, Stevey sits out and the squad runs with 5 agents.

#### Core Principles

| Principle | What Stevey Checks |
|-----------|-------------------|
| **Visual Quality** | Spacing scale consistency, alignment, typography hierarchy, color palette adherence, responsive behavior, hover/focus states, transitions |
| **UX Sensibility** | Loading states for async ops, error states with recovery paths, empty states that guide users, natural interaction flow, clear disabled states, destructive action confirmation |
| **Frontend Performance** | Unnecessary re-renders, layout thrashing, unoptimized images, bundle bloat, excessive DOM nodes, blocking scripts, lazy loading opportunities |
| **Accessibility** | WCAG AA contrast minimums, semantic HTML over div soup, ARIA labels on interactive elements, keyboard reachability, focus management, screen reader compatibility, live regions for dynamic content |

#### Consult Mode

During `/consult`, Stevey provides a **UX/UI Design Brief** covering:

- **Components needed** — what UI elements the feature requires, with their states
- **Interaction flow** — step-by-step user journey through the feature
- **Visual approach** — typography sizes/weights, spacing scale, color usage with contrast notes
- **State design** — how loading, empty, error, and success states look and behave
- **Responsive strategy** — behavior at each breakpoint
- **Accessibility plan** — specific ARIA labels, keyboard navigation patterns, and screen reader support needed
- **Existing patterns** — UI patterns already in the codebase that should be followed for consistency

#### Implement Mode

During `/implement`, Stevey writes frontend code within his defined domain:

- HTML structure and semantic markup
- CSS/SCSS/Tailwind styles and responsive layouts
- Frontend JS/TS — DOM manipulation, event handlers, state management
- Component architecture and composition
- Animations, transitions, and micro-interactions
- Loading/error/empty states
- Accessibility: ARIA, keyboard nav, focus management, live regions
- Asset optimization and lazy loading

**Implementation rules Stevey follows:**
- Every interactive element must be keyboard accessible
- Every async operation must have a loading state
- Every error must show a user-friendly message
- Semantic HTML first — `<div>` only when no semantic element fits
- Consumes interfaces defined by FC (data models) and Jared (API response shapes)
- Stays in his lane — no backend logic, no auth code, no database queries
- Commits each logical unit atomically

#### Review Mode

During `/review`, Stevey evaluates frontend code across four dimensions, rating each:

```
Visual:        Clean / Decent / Rough
UX:            Smooth / Okay / Clunky
Performance:   Fast / Fine / Sluggish
Accessibility: Solid / Gaps / Needs Work
```

Each finding is categorized and includes a fix suggestion:
- **Nice touches** — things done well worth calling out
- **Should fix** — tagged `[UX]`, `[VISUAL]`, `[PERF]`, or `[A11Y]` with specific remediation
- **Would be cool** — optional polish ideas, never blockers

**Hard rule:** Accessibility failures that prevent operation are always blockers. No exceptions, no debate.

#### Cross-Agent Dynamics

- **With FC:** Shared appreciation for craft. FC defines data interfaces, Stevey consumes them in the UI. They reinforce each other's quality standards.
- **With Jared:** "Fast UI = good UI." Stevey's performance focus aligns with Jared's efficiency mindset. Stevey consumes Jared's API response shapes in fetch calls.
- **With PM Cory:** Cory ensures Stevey reviewed all frontend files and checks for cross-cutting concerns between Stevey's UX findings and other agents' domain issues.
- **With Nando:** Nando weighs Stevey's findings against FC's and Jared's in the consolidated verdict. If Stevey flags an accessibility blocker, Nando enforces it.

---

## How It Works

### Review (`/review`)
Spawns FC, Jared, PM Cory in parallel (+ Stevey if frontend files changed). Each agent reads every changed file and reviews from their specialty. Nando then synthesizes all findings into a consolidated verdict (APPROVE / REVISE / BLOCK). Emily performs the final review checking plan adherence, accessibility, and UX intent (CONFIRM / CHALLENGE).

### Consultation (`/consult`)
Each agent analyzes the task from their domain — FC proposes architecture, Jared audits security and existing systems, Stevey designs UI components, PM Cory loads prior learnings and challenges assumptions. Nando resolves conflicts and produces an **Implementation Brief** with wave structure, scope assignments, and shared interfaces.

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
