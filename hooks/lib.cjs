#!/usr/bin/env node
'use strict';

/**
 * Shared utilities for mbscode hooks.
 *
 * Every hook needs the same handful of operations:
 * read JSON, read text, ensure directories, parse stdin, write output.
 * This module eliminates that duplication.
 */

const fs = require('fs');
const path = require('path');

// --- File helpers ---

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- Path helpers ---

function mbsDir(cwd) {
  return path.join(cwd || process.cwd(), '.mbscode');
}

function tasksDir(cwd) {
  return path.join(mbsDir(cwd), 'tasks');
}

function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

// --- Hook I/O ---

/**
 * Parse stdin as JSON, run the handler, catch errors with fail-open.
 *
 * Usage:
 *   runHook((data) => {
 *     // data = parsed stdin JSON
 *     return { additionalContext: '...' };  // or null to exit silently
 *   });
 */
function runHook(eventName, handler) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = input ? JSON.parse(input) : {};
      const result = handler(data);
      if (result === null || result === undefined) {
        process.exit(0);
        return;
      }
      if (result.block) {
        process.stderr.write(result.block);
        process.exit(2);
        return;
      }
      const output = {
        hookSpecificOutput: {
          hookEventName: eventName,
          additionalContext: result.additionalContext || ''
        }
      };
      process.stdout.write(JSON.stringify(output));
    } catch (err) {
      process.stderr.write(`[mbscode] ${eventName} error: ${err.message}\n`);
      process.exit(0);
    }
  });
}

// --- Task helpers ---

function listTaskFiles(cwd) {
  const dir = tasksDir(cwd);
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch { return []; }
}

function readTask(cwd, filename) {
  return readJSON(path.join(tasksDir(cwd), filename));
}

function findActiveTask(cwd) {
  const files = listTaskFiles(cwd);
  let latest = null, latestTime = 0;
  for (const f of files) {
    const fullPath = path.join(tasksDir(cwd), f);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs > latestTime) {
        const task = readJSON(fullPath);
        if (task && task.status === 'active') {
          latest = task;
          latestTime = stat.mtimeMs;
        }
      }
    } catch { /* skip */ }
  }
  return latest;
}

module.exports = {
  readJSON,
  readText,
  ensureDir,
  mbsDir,
  tasksDir,
  sanitizeId,
  runHook,
  listTaskFiles,
  readTask,
  findActiveTask,
  path,
  fs
};
