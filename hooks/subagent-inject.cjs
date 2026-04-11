#!/usr/bin/env node
'use strict';

/**
 * SubagentStart hook — inject standing rules and project context.
 *
 * Ensures every subagent knows:
 * - Standing rules from rules.md
 * - Project context (existing docs, source dirs)
 *
 * Input (stdin): { agent_id, agent_type, cwd, ... }
 * Output: additionalContext
 */

const fs = require('fs');
const path = require('path');

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
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

      if (!fs.existsSync(mbsDir)) {
        process.exit(0);
        return;
      }

      const rules = readText(path.join(mbsDir, 'rules.md'));
      const context = readJSON(path.join(mbsDir, 'context.json'));

      const parts = [];

      if (rules) {
        parts.push('[mbscode] Standing Rules:');
        parts.push(rules);
      }

      // Inject current task context — find most recently modified task
      const tasksDir = path.join(mbsDir, 'tasks');
      try {
        const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
        if (taskFiles.length > 0) {
          let latest = taskFiles[0], latestTime = 0;
          for (const tf of taskFiles) {
            const stat = fs.statSync(path.join(tasksDir, tf));
            if (stat.mtimeMs > latestTime) { latest = tf; latestTime = stat.mtimeMs; }
          }
          const task = readJSON(path.join(tasksDir, latest));
          if (task && task.status === 'active') {
            parts.push(`\n[mbscode] Current task: ${task.subject || '(no subject)'}`);
            if (task.acceptance?.length) {
              parts.push(`Acceptance: ${task.acceptance.join('; ')}`);
            }
            if (task.owned_paths?.length) {
              parts.push(`Files: ${task.owned_paths.join(', ')}`);
            }
            if (task.directives?.length) {
              parts.push(`Directives: ${task.directives.join('; ')}`);
            }
          }
        }
      } catch { /* ignore — task context is best-effort */ }

      if (context?.doc_files?.length) {
        parts.push(`\nExisting docs: ${context.doc_files.join(', ')}`);
      }

      if (parts.length === 0) {
        process.exit(0);
        return;
      }

      const output = {
        hookSpecificOutput: {
          hookEventName: 'SubagentStart',
          additionalContext: parts.join('\n')
        }
      };
      process.stdout.write(JSON.stringify(output));
    } catch (err) {
      process.stderr.write(`[mbscode] subagent-inject error: ${err.message}\n`);
      process.exit(0);
    }
  });
}

main();
