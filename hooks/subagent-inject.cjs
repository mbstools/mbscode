#!/usr/bin/env node
'use strict';

/**
 * SubagentStart hook — inject standing rules and active task context.
 *
 * Ensures every subagent knows:
 * - Standing rules from rules.md
 * - Active task context (acceptance, owned_paths, directives)
 * - Existing documentation files
 */

const { readText, readJSON, runHook, mbsDir, findActiveTask } = require('./lib.cjs');
const path = require('path');

runHook('SubagentStart', (data) => {
  const cwd = data.cwd || process.cwd();
  const mbs = mbsDir(cwd);

  const { fs } = require('./lib.cjs');
  if (!fs.existsSync(mbs)) return null;

  const rules = readText(path.join(mbs, 'rules.md'));
  const context = readJSON(path.join(mbs, 'context.json'));

  const parts = ['[mbscode] Discipline active. Follow standing rules and task scope below.'];

  if (rules) {
    parts.push('\n## Standing Rules');
    parts.push(rules);
  }

  const task = findActiveTask(cwd);
  if (task) {
    parts.push(`\n[mbscode] Current task: ${task.subject || '(no subject)'}`);
    if (task.acceptance?.length) parts.push(`Acceptance: ${task.acceptance.join('; ')}`);
    if (task.owned_paths?.length) parts.push(`Files: ${task.owned_paths.join(', ')}`);
    if (task.directives?.length) parts.push(`Directives: ${task.directives.join('; ')}`);
  }

  if (context?.doc_files?.length) {
    parts.push(`\nExisting docs: ${context.doc_files.join(', ')}`);
  }

  return { additionalContext: parts.join('\n') };
});
