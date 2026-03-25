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
