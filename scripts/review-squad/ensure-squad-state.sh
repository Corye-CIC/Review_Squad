#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "$REPO_ROOT")"
SQUAD_DIR="$REPO_ROOT/.review-squad/$PROJECT_NAME"
NOTES_DIR="$SQUAD_DIR/agent-notes"
SHIP_DIR="$SQUAD_DIR/ship"

mkdir -p "$NOTES_DIR" "$SHIP_DIR"

create_file() {
  local path="$1"
  local content="$2"
  if [ ! -f "$path" ]; then
    printf '%s\n' "$content" > "$path"
  fi
}

create_file "$SQUAD_DIR/codebase-map.md" "# Codebase Map

Living architecture notes for $PROJECT_NAME.
"

create_file "$SQUAD_DIR/patterns.md" "# Patterns

Project-specific good patterns and anti-patterns.
"

create_file "$SQUAD_DIR/review-history.md" "# Review History
"

create_file "$SQUAD_DIR/current-discussion.md" "# Current Discussion
"

create_file "$SQUAD_DIR/current-research.md" "# Current Research
"

create_file "$SQUAD_DIR/current-plan.md" "# Current Plan
"

create_file "$SQUAD_DIR/current-brief.md" "# Current Brief
"

if [ ! -f "$SQUAD_DIR/learnings.jsonl" ]; then
  : > "$SQUAD_DIR/learnings.jsonl"
fi

printf 'REPO_ROOT=%s\n' "$REPO_ROOT"
printf 'PROJECT_NAME=%s\n' "$PROJECT_NAME"
printf 'SQUAD_DIR=%s\n' "$SQUAD_DIR"
printf 'SHIP_DIR=%s\n' "$SHIP_DIR"
