---
name: audit
description: Run a deep security, architecture, and systems audit across the codebase or a specific subsystem
argument-hint: "[optional: path or subsystem to focus on, e.g., 'src/auth' or 'database schema']"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
```bash
source "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)/services/chat-bridge/init-session.sh" "audit" "$*"
```
<objective>
Run FC and Jared in deep audit mode to surface security vulnerabilities, architectural debt, schema health issues, dead code, and reuse opportunities. Nando synthesizes findings into a prioritized action list.

The audit team: `jared-audit` (security + architecture) + `father-christmas-audit` (systems + database) → `nando-review` (synthesis).
</objective>

<context>
$ARGUMENTS — Optional. Can be:
- Empty: audits the whole codebase
- Path: audits a specific directory or subsystem (e.g., `src/auth`, `src/db`)
- Subsystem label: audits by domain (e.g., `database schema`, `API boundaries`)
</context>

<process>

## Step 1: Load context

```bash
PROJECT_NAME=$(basename "$(pwd)")
SQUAD_DIR=".review-squad/${PROJECT_NAME}"
```

Check for `CONTEXT.md` in the working directory — if it exists, read it. It provides service-specific architecture context that helps both agents understand system boundaries.

If $ARGUMENTS specifies a path, resolve it and confirm it exists before passing to agents.

## Step 2: Spawn FC and Jared in parallel

Both agents audit independently. Spawn them simultaneously.

Each agent prompt must include:
- Working directory path
- Focus area (from $ARGUMENTS, or "entire codebase" if empty)
- CONTEXT.md contents if available
- Instruction to read files before forming opinions — no assumptions

**`father-christmas-audit`** — focus on:
- Database schema, query patterns, index coverage, migration health
- Dead code, duplication, established vs deprecated patterns
- Dependency hygiene

**`jared-audit`** — focus on:
- Auth flows, input validation, injection surfaces, secret handling
- System boundary coupling, data flow correctness, integration health
- Reinvented wheels and reuse opportunities

## Step 3: Synthesize with Nando

After both agents complete, spawn `nando-review` with all findings concatenated.

Nando's prompt:
```
You are synthesizing an audit (not a code review of a PR). The following are deep audit
findings from FC (systems/database) and Jared (security/architecture).

=== FC — Systems Audit ===
{fc_output}

=== JARED — Security & Architecture Audit ===
{jared_output}

Focus area: {arguments_or_whole_codebase}
Working directory: {cwd}

Produce a consolidated audit report:

## Critical (fix immediately — security or data integrity risk)
## High (fix before next feature — architectural debt blocking progress)
## Medium (schedule soon — quality or efficiency improvements)
## Low (backlog — nice-to-have cleanups)
## Highlights (things that are working well and should be preserved)

For each finding: source agent, file:line if applicable, concrete recommended action.
Resolve any conflicts between FC and Jared. If they agree, say so — it strengthens the finding.
```

## Step 4: Present results

Display the consolidated audit report.

```
## Audit Complete

{Nando's consolidated findings}

### Audit Scope
{What was audited — full codebase or specific subsystem}

### Next Steps
Address Critical findings before any new development.
High findings should be scheduled as dedicated cleanup work.
```

Save the audit report to `${SQUAD_DIR}/audit-<date>.md` for reference.

</process>

<success_criteria>
- [ ] FC and Jared audited in parallel
- [ ] Both agents read files before forming opinions
- [ ] Nando synthesized findings with priority tiers
- [ ] Conflicts between agents resolved
- [ ] Audit report saved to .review-squad/
- [ ] Clear next steps presented
</success_criteria>
