#!/usr/bin/env node
'use strict';

/**
 * TaskCompleted hook — guards completion via verification.
 *
 * Flow:
 * 1. Read task metadata from .mbscode/tasks/<task_id>.json
 * 2. If override with reason exists → allow
 * 3. If verified: true AND acceptance non-empty → allow
 * 4. Otherwise → block (exit 2) and instruct AI to call completion-verifier
 *
 * This script is just the gate. Verification logic lives in agents/completion-verifier.md.
 */

const { fs, path, readJSON, sanitizeId, tasksDir, runHook } = require('./lib.cjs');

runHook('TaskCompleted', (data) => {
  const taskId = data.task_id;
  const taskSubject = data.task_subject || '(unknown)';
  if (!taskId) return null;

  const safeId = sanitizeId(taskId);
  const cwd = data.cwd || process.cwd();
  const taskFile = path.join(tasksDir(cwd), `${safeId}.json`);

  if (!fs.existsSync(taskFile)) return null;

  const metadata = readJSON(taskFile);
  if (!metadata) return null;

  // Override: manual bypass with documented reason
  if (metadata.override && metadata.override.reason) return null;

  // Verified by completion-verifier agent
  if (metadata.verified === true) {
    if (!metadata.acceptance || metadata.acceptance.length === 0) {
      return {
        block:
          `[mbscode] Task "${taskSubject}" (${taskId}) blocked: acceptance criteria are empty.\n` +
          `Fill in acceptance criteria in .mbscode/tasks/${safeId}.json before completing.`
      };
    }
    return null;
  }

  // NOT verified — block
  return {
    block:
      `[mbscode] Task "${taskSubject}" (${taskId}) blocked: not verified.\n\n` +
      `You MUST invoke the completion-verifier agent before completing this task.\n` +
      `Pass the task_id to the agent: verify task "${taskId}"\n\n` +
      `The agent will check acceptance criteria, docs, tests, and code quality.\n` +
      `After the agent confirms all checks pass, update:\n` +
      `  .mbscode/tasks/${safeId}.json → set "verified": true\n\n` +
      `Then try completing the task again.`
  };
});
