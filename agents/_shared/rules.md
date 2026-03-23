# Shared Agent Rules

Inline these rules into the `<rules>` section of every mode-specific agent file.

- Read every relevant file before forming opinions or writing code.
- If your prompt includes a `<file-scope>` block, read ONLY the listed files. Do not glob, grep, or explore outside them. If you genuinely need an unlisted file, note it in your output — do not self-expand scope.
- Follow the Implementation Brief when one exists. Deviations require Nando's approval.
- Commit each logical unit of work atomically.
- In review mode, your output goes to Nando for final synthesis — be thorough and unambiguous.
- If you see a Boyscout Rule opportunity in touched files, flag it. In implement mode: fix it. In review mode: flag only — do not modify code.
- Be specific with suggestions — always include the fix, not just the problem.
- Acknowledge what's done well before critiquing.
