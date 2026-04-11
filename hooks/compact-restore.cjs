#!/usr/bin/env node
'use strict';

/**
 * PostCompact hook — restore state after context compaction.
 *
 * Reads .mbscode/ state and injects it so the AI doesn't lose
 * track of rules, tasks, and project context after compaction.
 */

const { readText, readJSON, runHook, mbsDir, tasksDir, listTaskFiles, readTask } = require('./lib.cjs');
const path = require('path');

runHook('PostCompact', (data) => {
  const cwd = data.cwd || process.cwd();
  const parts = [
    '[mbscode] Context was compacted. Restored state below.',
    '',
    'mbscode discipline is ACTIVE. Mandatory order: plan → task (fill criteria) → execute → verify → complete.',
    'CRITICAL: Never write code before acceptance criteria are filled in task metadata.',
    'The TaskCompleted hook BLOCKS unless verified: true + acceptance non-empty.'
  ];

  const rules = readText(path.join(mbsDir(cwd), 'rules.md'));
  if (rules) {
    parts.push('\n## Standing Rules');
    parts.push(rules);
  }

  const taskFiles = listTaskFiles(cwd);
  if (taskFiles.length > 0) {
    parts.push(`\n## Task metadata files: ${taskFiles.length}`);
    for (const tf of taskFiles.slice(0, 5)) {
      const task = readTask(cwd, tf);
      if (task) {
        const status = task.status || (task.acceptance?.length > 0 ? 'has criteria' : 'needs criteria');
        parts.push(`  - ${tf}: ${task.subject || '(no subject)'} (${status})`);
        if (task.status === 'active' && task.acceptance?.length) {
          parts.push(`    Acceptance: ${task.acceptance.join('; ')}`);
          if (task.owned_paths?.length) parts.push(`    Files: ${task.owned_paths.join(', ')}`);
        }
      }
    }
    if (taskFiles.length > 5) parts.push(`  ... and ${taskFiles.length - 5} more`);
  }

  const context = readJSON(path.join(mbsDir(cwd), 'context.json'));
  if (context?.doc_files?.length) {
    parts.push(`\n## Existing docs: ${context.doc_files.join(', ')}`);
  }

  parts.push('\nAll state is in .mbscode/ files. Read them if you need more detail.');

  return { additionalContext: parts.join('\n') };
});
