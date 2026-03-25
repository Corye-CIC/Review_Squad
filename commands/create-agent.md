---
name: create-agent
description: Interactively create a custom Claude Code agent via Q&A and write it to ~/.claude/agents/
argument-hint: ""
allowed-tools:
  - Bash
  - AskUserQuestion
---
<objective>
Guide the user through creating a custom Claude Code agent via a 5-question Q&A. Template-first: user picks a starting template, then customises name, specialization, tone, and tools. Shows a full preview before writing anything. Outputs `~/.claude/agents/custom-{name}.md`.

Custom agents use the `custom-` prefix so `/update` never overwrites them and they can be dispatched via `/quick <task> custom-{name}`.
</objective>

<templates>

Each template defines: default_tools, focus_areas (3-5 bullets), role_framing.

**security-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "security-focused code reviewer specialising in {specialization}"
- focus_areas:
  - Input validation and sanitization at all system boundaries
  - Authentication and authorisation checks — missing guards, privilege escalation
  - Injection vulnerabilities: SQL, XSS, command injection, path traversal
  - Secrets and credentials — hardcoded values, logged tokens, insecure storage
  - Dependency vulnerabilities and insecure configurations

**code-quality-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "code quality reviewer specialising in {specialization}"
- focus_areas:
  - Naming — clear, intention-revealing names for variables, functions, types
  - Structure — single responsibility, appropriate abstraction levels
  - DRY — duplication, opportunities to extract shared logic
  - Patterns — consistent use of established patterns; deviations flagged
  - Readability — code that reads like well-written prose, minimal comments needed

**domain-expert**
- default_tools: Read, Grep, Glob, Bash
- role_framing: "domain expert in {specialization}"
- focus_areas: (derived from specialization — generate 3-5 relevant checks based on the domain the user describes in Q3)

**documentation-reviewer**
- default_tools: Read, Grep, Glob
- role_framing: "documentation reviewer specialising in {specialization}"
- focus_areas:
  - Accuracy — does the documentation match what the code actually does?
  - Completeness — are parameters, return values, errors, and edge cases covered?
  - Comment rot — outdated comments that contradict current behaviour
  - Stale examples — code examples that no longer compile or run correctly
  - Missing docs — public APIs, complex functions, and non-obvious decisions without explanation

**performance-reviewer**
- default_tools: Read, Grep, Glob, Bash
- role_framing: "performance reviewer specialising in {specialization}"
- focus_areas:
  - N+1 queries — loops that trigger repeated database or API calls
  - Memory — unbounded collections, large allocations, potential leaks
  - Redundant calls — duplicate API calls, repeated expensive computations
  - Hot paths — expensive operations in tight loops or frequently called functions
  - Missing caching — repeated identical work that could be memoised or cached

**blank**
- default_tools: Read, Grep, Glob
- role_framing: (derived entirely from user's Q3 free-form description)
- focus_areas: (derived entirely from user's Q3 free-form description)

</templates>
