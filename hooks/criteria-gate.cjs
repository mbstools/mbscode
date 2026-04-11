#!/usr/bin/env node
'use strict';

/**
 * PreToolUse hook for Write/Edit — blocks code writing when acceptance is empty.
 *
 * Logic:
 * 1. If file being written is inside .mbscode/ → allow (metadata edits)
 * 2. If no active task exists → allow (mbscode not in use yet)
 * 3. If active task has empty acceptance → BLOCK
 * 4. Otherwise → allow
 *
 * This is the hard enforcement that prevents "code first, criteria later."
 */

const { fs, path, readJSON, tasksDir, listTaskFiles } = require('./lib.cjs');

const { runHook } = require('./lib.cjs');

runHook('PreToolUse', (data) => {
  const cwd = data.cwd || process.cwd();
  const toolInput = data.tool_input || {};
  const filePath = toolInput.file_path || '';

  // Allow .mbscode/ edits — filling metadata must always work
  const mbsPath = path.join(cwd, '.mbscode');
  if (filePath.replace(/\\/g, '/').includes('.mbscode/') || filePath.startsWith(mbsPath)) {
    return null;
  }

  // Find active tasks with empty acceptance
  const taskFiles = listTaskFiles(cwd);
  if (taskFiles.length === 0) return null;

  for (const tf of taskFiles) {
    const task = readJSON(path.join(tasksDir(cwd), tf));
    if (!task) continue;
    if (task.status !== 'active') continue;

    // Active task exists — check acceptance
    if (!task.acceptance || task.acceptance.length === 0) {
      const safeId = tf.replace('.json', '');
      return {
        block:
          `[mbscode] ⚠ BLOCKED: Cannot write code — acceptance criteria are empty.\n\n` +
          `Task "${task.subject || safeId}" has no acceptance criteria.\n` +
          `You must fill them BEFORE writing any code.\n\n` +
          `Edit .mbscode/tasks/${tf} and add specific, verifiable criteria:\n` +
          `  "acceptance": [\n` +
          `    "node todo.js add 'test' creates a new entry in todos.json",\n` +
          `    "node todo.js list shows all todos with id, status, and text",\n` +
          `    ...\n` +
          `  ]\n\n` +
          `Then try writing code again.`
      };
    }
  }

  return null;
});
