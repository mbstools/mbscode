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
 *
 * Input (stdin): { task_id, task_subject, task_description, ... }
 * Output: stderr message fed to model as guidance
 */

const fs = require('fs');
const path = require('path');

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const taskId = data.task_id;
      const subject = data.task_subject || '';

      if (!taskId) {
        process.exit(0);
        return;
      }

      // Sanitize task_id — prevent path traversal
      const safeId = String(taskId).replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!safeId) {
        process.exit(0);
        return;
      }

      const cwd = data.cwd || process.cwd();
      const mbsDir = path.join(cwd, '.mbscode');
      const tasksDir = path.join(mbsDir, 'tasks');

      if (!fs.existsSync(mbsDir)) fs.mkdirSync(mbsDir, { recursive: true });
      if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });

      const taskFile = path.join(tasksDir, `${safeId}.json`);

      if (fs.existsSync(taskFile)) {
        process.exit(0);
        return;
      }

      const metadata = {
        task_id: safeId,
        subject: subject,
        status: 'active',
        acceptance: [],
        doc_targets: [],
        owned_paths: [],
        directives: [],
        progress: [],
        decisions: []
      };

      fs.writeFileSync(taskFile, JSON.stringify(metadata, null, 2) + '\n');

      // Use stdout additionalContext so the AI sees this message
      const output = {
        hookSpecificOutput: {
          hookEventName: 'TaskCreated',
          additionalContext:
            `[mbscode] Task metadata created: .mbscode/tasks/${safeId}.json\n` +
            `REQUIRED: Fill in acceptance, doc_targets, and owned_paths before starting work.\n` +
            `The completion verifier will DENY completion if acceptance is empty.`
        }
      };
      process.stdout.write(JSON.stringify(output));
    } catch (err) {
      process.stderr.write(`[mbscode] task-init error: ${err.message}\n`);
      process.exit(0);
    }
  });
}

main();
