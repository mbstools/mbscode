#!/usr/bin/env node
'use strict';

/**
 * PostCompact hook — restore state after context compaction.
 *
 * Reads .mbscode/ state and injects it as additionalContext
 * so the AI doesn't lose track of rules and task context.
 *
 * Input (stdin): { cwd, ... }
 * Output: additionalContext with restored state
 */

const fs = require('fs');
const path = require('path');

function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const cwd = data.cwd || process.cwd();
      const mbsDir = path.join(cwd, '.mbscode');

      const parts = ['[mbscode] Context was compacted. Restored state:'];

      // Re-read the full rules
      const rules = readText(path.join(mbsDir, 'rules.md'));
      if (rules) {
        parts.push('\n## Standing Rules');
        parts.push(rules);
      }

      // List task metadata files with details (match session-init behavior)
      const tasksDir = path.join(mbsDir, 'tasks');
      try {
        const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
        if (taskFiles.length > 0) {
          parts.push(`\n## Task metadata files: ${taskFiles.length}`);
          for (const tf of taskFiles.slice(0, 5)) {
            try {
              const task = JSON.parse(fs.readFileSync(path.join(tasksDir, tf), 'utf8'));
              const status = task.status || (task.acceptance?.length > 0 ? 'has criteria' : 'needs criteria');
              parts.push(`  - ${tf}: ${task.subject || '(no subject)'} (${status})`);
              if (task.status === 'active' && task.acceptance?.length) {
                parts.push(`    Acceptance: ${task.acceptance.join('; ')}`);
                if (task.owned_paths?.length) parts.push(`    Files: ${task.owned_paths.join(', ')}`);
              }
            } catch { /* skip individual file errors */ }
          }
          if (taskFiles.length > 5) parts.push(`  ... and ${taskFiles.length - 5} more`);
        }
      } catch { /* ignore */ }

      // Re-read project context
      const context = readJSON(path.join(mbsDir, 'context.json'));
      if (context?.doc_files?.length) {
        parts.push(`\n## Existing docs: ${context.doc_files.join(', ')}`);
      }

      parts.push('\nAll state is in .mbscode/ files. Read them if you need more detail.');

      const output = {
        hookSpecificOutput: {
          hookEventName: 'PostCompact',
          additionalContext: parts.join('\n')
        }
      };
      process.stdout.write(JSON.stringify(output));
    } catch (err) {
      process.stderr.write(`[mbscode] compact-restore error: ${err.message}\n`);
      process.exit(0);
    }
  });
}

main();
