#!/usr/bin/env node
'use strict';

/**
 * TaskCreated hook — initializes task metadata.
 *
 * When a task is created via native TaskCreate, this hook:
 * 1. Creates .mbscode/tasks/<task_id>.json with skeleton metadata
 * 2. Injects a reminder to fill in acceptance criteria
 *
 * Does NOT block task creation — only sets up metadata structure.
 */

const { fs, path, ensureDir, mbsDir, tasksDir, sanitizeId, runHook } = require('./lib.cjs');

runHook('TaskCreated', (data) => {
  const taskId = data.task_id;
  if (!taskId) return null;

  const safeId = sanitizeId(taskId);
  if (!safeId) return null;

  const cwd = data.cwd || process.cwd();
  ensureDir(mbsDir(cwd));
  ensureDir(tasksDir(cwd));

  const taskFile = path.join(tasksDir(cwd), `${safeId}.json`);
  if (fs.existsSync(taskFile)) return null;

  const metadata = {
    task_id: safeId,
    subject: data.task_subject || '',
    status: 'active',
    acceptance: [],
    doc_targets: [],
    owned_paths: [],
    directives: [],
    progress: [],
    decisions: []
  };

  fs.writeFileSync(taskFile, JSON.stringify(metadata, null, 2) + '\n');

  return {
    additionalContext:
      `[mbscode] Task metadata created: .mbscode/tasks/${safeId}.json\n\n` +
      `⚠ STOP — do NOT write any code yet. You must do these steps FIRST:\n\n` +
      `1. Edit .mbscode/tasks/${safeId}.json and fill in:\n` +
      `   - "acceptance": specific, code-verifiable criteria (e.g. "POST /users returns 201 with user object")\n` +
      `   - "owned_paths": files you will create or modify (e.g. ["src/todo.js", "tests/todo.test.js"])\n` +
      `   - "doc_targets": existing docs (README.md, etc.) that your changes affect — check the project for docs\n\n` +
      `2. Show the acceptance criteria to the user and confirm before coding.\n\n` +
      `3. Only after criteria are filled AND confirmed, start writing code.\n\n` +
      `The completion verifier will DENY completion if acceptance is empty.\n` +
      `Filling criteria AFTER coding defeats the purpose — criteria guide implementation, not document it.`
  };
});
