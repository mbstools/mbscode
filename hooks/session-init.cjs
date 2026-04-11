#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook — fires when a Claude Code session begins.
 *
 * 1. Creates .mbscode/ directory if it doesn't exist
 * 2. Discovers project context (source dirs, docs, manifests)
 * 3. Reads rules and task metadata
 * 4. Injects everything as additionalContext
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MBS = path.join(ROOT, '.mbscode');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }
}

function discoverContext() {
  const context = { source_dirs: [], doc_files: [], manifests: [], has_git: false };
  const candidates = ['src', 'lib', 'app', 'pkg', 'cmd', 'server', 'api', 'core'];
  for (const d of candidates) {
    if (fs.existsSync(path.join(ROOT, d))) context.source_dirs.push(d);
  }
  if (fs.existsSync(path.join(ROOT, 'docs'))) {
    try {
      const entries = fs.readdirSync(path.join(ROOT, 'docs'));
      context.doc_files = entries.filter(e => e.endsWith('.md'));
    } catch { /* ignore */ }
  }
  const manifestNames = [
    'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
    'requirements.txt', 'Gemfile', 'pom.xml', 'build.gradle'
  ];
  for (const m of manifestNames) {
    if (fs.existsSync(path.join(ROOT, m))) context.manifests.push(m);
  }
  context.has_git = fs.existsSync(path.join(ROOT, '.git'));
  return context;
}

function main() {
  ensureDir(MBS);
  ensureDir(path.join(MBS, 'tasks'));

  // Always refresh context on session start
  const contextPath = path.join(MBS, 'context.json');
  const context = discoverContext();
  fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));

  // Read standing rules
  const rules = readText(path.join(MBS, 'rules.md'));

  // List existing task metadata files
  const tasksDir = path.join(MBS, 'tasks');
  let taskFiles = [];
  try {
    taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
  } catch { /* ignore */ }

  // Build context injection
  const parts = ['[mbscode] Session initialized.'];

  if (taskFiles.length > 0) {
    parts.push(`\n## Task metadata files: ${taskFiles.length}`);
    for (const tf of taskFiles.slice(0, 5)) {
      const task = readJSON(path.join(tasksDir, tf));
      if (task) {
        const status = task.acceptance?.length > 0 ? 'has criteria' : 'needs criteria';
        parts.push(`  - ${tf}: ${task.subject || '(no subject)'} (${status})`);
      }
    }
    if (taskFiles.length > 5) parts.push(`  ... and ${taskFiles.length - 5} more`);
  }

  if (rules) {
    parts.push('\n## Standing Rules');
    parts.push(rules);
  }

  if (context.doc_files?.length) {
    parts.push(`\n## Existing docs: ${context.doc_files.join(', ')}`);
  }

  if (context.source_dirs?.length) {
    parts.push(`## Source dirs: ${context.source_dirs.join(', ')}`);
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: parts.join('\n')
    }
  };

  process.stdout.write(JSON.stringify(output));
}

main();
