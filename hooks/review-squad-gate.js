#!/usr/bin/env node
// Review Squad Gate — PostToolUse hook
//
// Fires the Review Squad advisory in two modes:
//
// MODE 1 — GSD: Detects gsd-tools phase complete / phase completion commits.
// MODE 2 — Standard sessions: Detects coding session wrap-up signals:
//   - Pre-commit: git add/commit commands after file edits
//   - Test invocation: test runner commands (vitest, jest, pytest, playwright, etc.)
//   - Edit threshold: 5+ unique files edited via Edit/Write tools
//
// Debounce: 10 minutes between advisories per session.
// Tracks edit counts in a temp file per session.

const fs = require('fs');
const path = require('path');
const os = require('os');

const EDIT_THRESHOLD = 5;       // Unique files edited before suggesting review
const DEBOUNCE_MS = 600000;     // 10 minutes between advisories

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name;
    const toolInput = data.tool_input || {};
    const toolOutput = data.tool_output?.content || data.tool_output?.stdout || '';
    const cwd = data.cwd || process.cwd();
    const sessionId = data.session_id || 'unknown';

    // Check if review squad agents exist (globally or locally)
    const hasSquad = fs.existsSync(path.join(cwd, '.review-squad')) ||
      fs.existsSync(path.join(cwd, '.claude', 'agents', 'nando.md')) ||
      fs.existsSync(path.join(process.env.HOME || '', '.claude', 'agents', 'nando.md'));

    if (!hasSquad) {
      process.exit(0);
    }

    // ── Session state file (tracks edits + debounce) ──
    const stateFile = path.join(os.tmpdir(), `review-squad-${sessionId}.json`);
    let state = { editedFiles: [], lastFired: 0, reviewRun: false, failureDetected: false, successDetected: false };

    if (fs.existsSync(stateFile)) {
      try {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        if (!Array.isArray(state.editedFiles)) state.editedFiles = [];
      } catch (e) {
        state = { editedFiles: [], lastFired: 0, reviewRun: false, failureDetected: false, successDetected: false };
      }
    }

    // ── Check for /ship async PR results (before debounce) ──
    try {
      const projectName = path.basename(cwd);
      const squadDir = path.join(cwd, '.review-squad', projectName);

      // Check for pr-failure.md from async watcher
      const failurePath = path.join(squadDir, 'pr-failure.md');
      if (!state.failureDetected && fs.existsSync(failurePath)) {
        try {
          let failureContent = fs.readFileSync(failurePath, 'utf-8');
          // Truncate to prevent context flooding
          if (failureContent.length > 5000) {
            failureContent = failureContent.substring(0, 5000) + '\n\n... (truncated)';
          }
          state.failureDetected = true;
          fs.writeFileSync(stateFile, JSON.stringify(state));

          const message = `PR FAILURE DETECTED: A CI check failed after you left.\n\n` +
            `${failureContent}\n\n` +
            `Route to FC + Jared for resolution? (They will read the failure, diagnose, fix, and push.)`;

          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PostToolUse',
              additionalContext: message
            }
          }));
          process.exit(0);
        } catch (e) {
          // Malformed pr-failure.md — don't crash the hook
        }
      }

      // Check for pr-success.md (informational)
      const successPath = path.join(squadDir, 'pr-success.md');
      if (!state.successDetected && fs.existsSync(successPath)) {
        try {
          state.successDetected = true;
          fs.writeFileSync(stateFile, JSON.stringify(state));

          const message = `PR SUCCESS: All CI checks passed. PR is green and ready for merge.`;

          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PostToolUse',
              additionalContext: message
            }
          }));
          try { fs.unlinkSync(successPath); } catch (e2) { /* cleanup best-effort */ }
          process.exit(0);
        } catch (e) {
          // File cleanup failed — not critical
        }
      }

      // Check for pr-timeout.md (informational)
      const timeoutPath = path.join(squadDir, 'pr-timeout.md');
      if (fs.existsSync(timeoutPath)) {
        try {
          let timeoutContent = fs.readFileSync(timeoutPath, 'utf8');
          if (timeoutContent.length > 2000) {
            timeoutContent = timeoutContent.substring(0, 2000) + '\n\n... (truncated)';
          }
          const message = `CI TIMEOUT: CI checks did not complete within the monitoring window.\n\n` +
            `${timeoutContent}\n\n` +
            `Check CI status manually or re-run /ship to retry monitoring.`;

          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PostToolUse',
              additionalContext: message
            }
          }));
          try { fs.unlinkSync(timeoutPath); } catch (e2) { /* cleanup best-effort */ }
          process.exit(0);
        } catch (e) {
          // Timeout detection failed — not critical
        }
      }
    } catch (e) {
      // PR result detection must never crash the hook
    }

    // ── Debounce check ──
    const now = Date.now();
    if (state.lastFired && (now - state.lastFired) < DEBOUNCE_MS) {
      // Still track edits even when debounced
      if (toolName === 'Edit' || toolName === 'Write') {
        const filePath = toolInput.file_path || '';
        if (filePath && !filePath.includes('.planning/') && !filePath.includes('e2e/') && !filePath.includes('.review-squad/')) {
          if (!state.editedFiles.includes(filePath)) {
            state.editedFiles.push(filePath);
            fs.writeFileSync(stateFile, JSON.stringify(state));
          }
        }
      }
      process.exit(0);
    }

    // ── Track file edits (Edit/Write tools) ──
    if (toolName === 'Edit' || toolName === 'Write') {
      const filePath = toolInput.file_path || '';
      if (filePath && !filePath.includes('.planning/') && !filePath.includes('e2e/') && !filePath.includes('.review-squad/')) {
        if (!state.editedFiles.includes(filePath)) {
          state.editedFiles.push(filePath);
          fs.writeFileSync(stateFile, JSON.stringify(state));
        }
      }
      process.exit(0); // Edits alone don't trigger — wait for a wrap-up signal
    }

    // ── If review was already run this session and accepted, don't nag ──
    if (state.reviewRun) {
      process.exit(0);
    }

    // ── Detect review completion (Nando's final verdict from a /review run) ──
    if (toolName === 'Agent') {
      const outputStr = typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput);
      if (/Review Squad:\s*(APPROVED|REVISE|BLOCK)/i.test(outputStr) ||
          /Final Verdict:\s*(APPROVE|REVISE|BLOCK)/i.test(outputStr)) {
        state.reviewRun = true;
        fs.writeFileSync(stateFile, JSON.stringify(state));
        process.exit(0);
      }
    }

    // ── Minimum edit threshold ──
    // Don't fire if fewer than 2 files were edited (trivial change, not worth a squad review)
    const editCount = state.editedFiles.length;
    if (editCount < 2) {
      process.exit(0);
    }

    // ── MODE 1: GSD phase completion ──
    let isGsdTrigger = false;
    let phaseNum = null;

    if (toolName === 'Bash' || toolName === 'Agent') {
      const command = toolInput.command || '';
      const outputStr = typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput);

      const isPhaseComplete = command.includes('phase complete') && command.includes('gsd-tools');
      const isCompletionCommit = command.includes('git commit') &&
        /docs\(phase-\d+\):\s*complete phase execution/i.test(command);
      const isExecutionComplete = toolName === 'Agent' &&
        /phase.*execution\s*complete/i.test(outputStr);

      if (isPhaseComplete || isCompletionCommit || isExecutionComplete) {
        isGsdTrigger = true;
        const phaseMatch = command.match(/(?:phase complete|phase-(\d+))\s*["']?(\d+)?/);
        phaseNum = phaseMatch ? (phaseMatch[2] || phaseMatch[1] || '?') : '?';
      }
    }

    // ── MODE 2: Standard session wrap-up signals ──
    let isStandardTrigger = false;
    let triggerReason = '';

    if (!isGsdTrigger && toolName === 'Bash') {
      const command = toolInput.command || '';

      // Signal: git commit (wrapping up work)
      if (/git\s+commit\b/.test(command) && !/--amend/.test(command)) {
        isStandardTrigger = true;
        triggerReason = 'pre-commit';
      }

      // Signal: git add of multiple files (staging for commit)
      if (/git\s+add\b/.test(command) && !/git\s+add\s+-p/.test(command)) {
        // Only trigger on git add if we have enough edits
        if (editCount >= EDIT_THRESHOLD) {
          isStandardTrigger = true;
          triggerReason = 'staging';
        }
      }

      // Signal: test runner invocation
      if (/\b(vitest|jest|pytest|mocha|playwright|cypress|npm\s+test|npm\s+run\s+test|npx\s+(vitest|jest|playwright))\b/.test(command)) {
        isStandardTrigger = true;
        triggerReason = 'test-run';
      }
    }

    // ── Also fire on edit threshold if a Bash command is running (any command = activity) ──
    if (!isGsdTrigger && !isStandardTrigger && toolName === 'Bash' && editCount >= EDIT_THRESHOLD) {
      // Check if this looks like a build/lint/compile command
      const command = toolInput.command || '';
      if (/\b(npm\s+run|npx\s+tsc|npx\s+eslint|make|cargo\s+build|go\s+build|pip\s+install)\b/.test(command)) {
        isStandardTrigger = true;
        triggerReason = 'edit-threshold-build';
      }
    }

    if (!isGsdTrigger && !isStandardTrigger) {
      process.exit(0);
    }

    // ── Fire advisory ──
    state.lastFired = now;
    fs.writeFileSync(stateFile, JSON.stringify(state));

    let message;

    if (isGsdTrigger) {
      message = `REVIEW SQUAD GATE: Phase ${phaseNum} execution appears complete. ` +
        'Before proceeding to verification, the Review Squad should review the changed code. ' +
        `Run \`/gsd:review ${phaseNum}\` to spawn the full review squad. ` +
        'If the user has already approved skipping review, proceed to verification.';
    } else {
      const fileList = state.editedFiles.length <= 8
        ? state.editedFiles.map(f => path.basename(f)).join(', ')
        : `${state.editedFiles.length} files`;

      const triggerDesc = {
        'pre-commit': 'A commit is being prepared',
        'staging': 'Files are being staged for commit',
        'test-run': 'Tests are about to run',
        'edit-threshold-build': `${editCount} files have been modified and a build is running`
      }[triggerReason] || 'Significant code changes detected';

      message = `REVIEW SQUAD ADVISORY: ${triggerDesc}. ` +
        `${state.editedFiles.length} file(s) changed this session (${fileList}). ` +
        'Consider running the Review Squad before committing or testing. ' +
        'Ask the user: "Would you like to run the Review Squad on these changes before proceeding?" ' +
        'If declined, continue normally. Spawn agents: father-christmas, jared, ' +
        'stevey-boy-choi, pm-cory in parallel, then nando to synthesize.';
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: message
      }
    }));
  } catch (e) {
    process.exit(0);
  }
});
