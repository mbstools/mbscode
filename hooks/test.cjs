#!/usr/bin/env node
'use strict';

/**
 * Hook test suite — no external dependencies.
 *
 * Tests each hook's behavior:
 * - Correct output on valid input
 * - Graceful exit on missing/invalid input
 * - Fail-open on errors (guard hook excepted)
 *
 * Usage: node hooks/test.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOOKS_DIR = __dirname;
const TEST_DIR = path.join(require('os').tmpdir(), `mbscode-test-${Date.now()}`);

let passed = 0;
let failed = 0;

function setup() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, '.mbscode', 'tasks'), { recursive: true });
}

function cleanup() {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

function run(hookFile, input) {
  const inputStr = JSON.stringify(input);
  const hookPath = path.join(HOOKS_DIR, hookFile);
  try {
    const stdout = execSync(`node "${hookPath}"`, {
      cwd: TEST_DIR,
      input: inputStr,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status
    };
  }
}

function assert(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    if (detail) console.log(`    → ${detail}`);
  }
}

// --- session-init tests ---

function testSessionInit() {
  console.log('\nsession-init.cjs');

  const r = run('session-init.cjs', {});
  const out = JSON.parse(r.stdout);
  assert('returns hookSpecificOutput', !!out.hookSpecificOutput);
  assert('eventName is SessionStart', out.hookSpecificOutput?.hookEventName === 'SessionStart');
  assert('creates .mbscode directory', fs.existsSync(path.join(TEST_DIR, '.mbscode')));
  assert('creates context.json', fs.existsSync(path.join(TEST_DIR, '.mbscode', 'context.json')));
  assert('creates tasks directory', fs.existsSync(path.join(TEST_DIR, '.mbscode', 'tasks')));

  // With rules
  fs.writeFileSync(path.join(TEST_DIR, '.mbscode', 'rules.md'), '## Test Rule\n- Do X');
  const r2 = run('session-init.cjs', {});
  const out2 = JSON.parse(r2.stdout);
  assert('includes standing rules', out2.hookSpecificOutput.additionalContext.includes('Standing Rules'));
  assert('includes rule content', out2.hookSpecificOutput.additionalContext.includes('Do X'));
}

// --- task-init tests ---

function testTaskInit() {
  console.log('\ntask-init.cjs');

  const r = run('task-init.cjs', { task_id: 'test-001', task_subject: 'Test task' });
  const out = JSON.parse(r.stdout);
  assert('returns hookSpecificOutput', !!out.hookSpecificOutput);
  assert('creates metadata file', fs.existsSync(path.join(TEST_DIR, '.mbscode', 'tasks', 'test-001.json')));

  const meta = JSON.parse(fs.readFileSync(path.join(TEST_DIR, '.mbscode', 'tasks', 'test-001.json'), 'utf8'));
  assert('metadata has task_id', meta.task_id === 'test-001');
  assert('metadata has subject', meta.subject === 'Test task');
  assert('acceptance starts empty', Array.isArray(meta.acceptance) && meta.acceptance.length === 0);
  assert('status is active', meta.status === 'active');

  // Duplicate task — should exit silently
  const r2 = run('task-init.cjs', { task_id: 'test-001', task_subject: 'Test task' });
  assert('duplicate task exits silently', r2.exitCode === 0 && r2.stdout === '');

  // No task_id — should exit silently
  const r3 = run('task-init.cjs', {});
  assert('missing task_id exits silently', r3.exitCode === 0 && r3.stdout === '');

  // Path traversal — sanitized
  const r4 = run('task-init.cjs', { task_id: '../../../etc/passwd', task_subject: 'Evil' });
  assert('path traversal sanitized', !fs.existsSync(path.join(TEST_DIR, '..', '..', '..', 'etc', 'passwd')));
}

// --- task-complete-guard tests ---

function testCompleteGuard() {
  console.log('\ntask-complete-guard.cjs');

  // Not verified — should block
  const r1 = run('task-complete-guard.cjs', { task_id: 'test-001', task_subject: 'Test task' });
  assert('blocks unverified task', r1.exitCode === 2);
  assert('block message mentions verifier', (r1.stderr || '').includes('completion-verifier'));

  // Set verified but empty acceptance — should block
  const taskFile = path.join(TEST_DIR, '.mbscode', 'tasks', 'test-001.json');
  const meta = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
  meta.verified = true;
  fs.writeFileSync(taskFile, JSON.stringify(meta));
  const r2 = run('task-complete-guard.cjs', { task_id: 'test-001', task_subject: 'Test task' });
  assert('blocks verified but empty acceptance', r2.exitCode === 2);

  // Set acceptance — should pass
  meta.acceptance = ['Test criterion'];
  fs.writeFileSync(taskFile, JSON.stringify(meta));
  const r3 = run('task-complete-guard.cjs', { task_id: 'test-001', task_subject: 'Test task' });
  assert('allows verified with acceptance', r3.exitCode === 0);

  // Override — should pass regardless
  delete meta.verified;
  meta.acceptance = [];
  meta.override = { reason: 'Testing override' };
  fs.writeFileSync(taskFile, JSON.stringify(meta));
  const r4 = run('task-complete-guard.cjs', { task_id: 'test-001', task_subject: 'Test task' });
  assert('override bypasses guard', r4.exitCode === 0);

  // Missing task — should pass (no metadata to check)
  const r5 = run('task-complete-guard.cjs', { task_id: 'nonexistent', task_subject: 'Ghost' });
  assert('missing task passes (fail-open)', r5.exitCode === 0);
}

// --- subagent-inject tests ---

function testSubagentInject() {
  console.log('\nsubagent-inject.cjs');

  // With rules and active task
  const taskFile = path.join(TEST_DIR, '.mbscode', 'tasks', 'test-001.json');
  const meta = {
    task_id: 'test-001', subject: 'Test task', status: 'active',
    acceptance: ['Criterion A'], owned_paths: ['src/a.ts'], directives: ['Use TypeScript']
  };
  fs.writeFileSync(taskFile, JSON.stringify(meta));

  const r = run('subagent-inject.cjs', {});
  const out = JSON.parse(r.stdout);
  const ctx = out.hookSpecificOutput.additionalContext;
  assert('includes standing rules', ctx.includes('Standing Rules') || ctx.includes('Test Rule'));
  assert('includes task subject', ctx.includes('Test task'));
  assert('includes acceptance', ctx.includes('Criterion A'));
  assert('includes owned_paths', ctx.includes('src/a.ts'));
  assert('includes directives', ctx.includes('Use TypeScript'));
}

// --- compact-restore tests ---

function testCompactRestore() {
  console.log('\ncompact-restore.cjs');

  const r = run('compact-restore.cjs', {});
  const out = JSON.parse(r.stdout);
  const ctx = out.hookSpecificOutput.additionalContext;
  assert('includes compaction notice', ctx.includes('compacted'));
  assert('includes task listing', ctx.includes('test-001.json'));
  assert('includes task subject', ctx.includes('Test task'));
  assert('includes footer', ctx.includes('All state is in .mbscode/'));
}

// --- criteria-gate tests ---

function testCriteriaGate() {
  console.log('\ncriteria-gate.cjs');

  // Setup: clean all task files, create only the one we're testing
  const tDir = path.join(TEST_DIR, '.mbscode', 'tasks');
  for (const f of fs.readdirSync(tDir)) fs.unlinkSync(path.join(tDir, f));
  const taskFile = path.join(tDir, 'test-001.json');
  const cleanTask = { task_id: 'test-001', subject: 'Test task', status: 'active', acceptance: [] };
  fs.writeFileSync(taskFile, JSON.stringify(cleanTask));

  // Active task with empty acceptance → should block code writes
  const r1 = run('criteria-gate.cjs', {
    cwd: TEST_DIR,
    tool_input: { file_path: path.join(TEST_DIR, 'src', 'app.js') }
  });
  assert('blocks code write with empty acceptance', r1.exitCode === 2);
  assert('block message mentions criteria', (r1.stderr || '').includes('acceptance criteria'));

  // Writing to .mbscode/ → should always allow (metadata edits)
  const r2 = run('criteria-gate.cjs', {
    cwd: TEST_DIR,
    tool_input: { file_path: path.join(TEST_DIR, '.mbscode', 'tasks', 'test-001.json') }
  });
  assert('allows .mbscode/ edits', r2.exitCode === 0);

  // Fill acceptance criteria, then try again
  cleanTask.acceptance = ['Test criterion'];
  fs.writeFileSync(taskFile, JSON.stringify(cleanTask));

  const r3 = run('criteria-gate.cjs', {
    cwd: TEST_DIR,
    tool_input: { file_path: path.join(TEST_DIR, 'src', 'app.js') }
  });
  assert('allows code write with filled acceptance', r3.exitCode === 0);

  // Cancel the task, empty acceptance → should allow (no active task)
  cleanTask.status = 'cancelled';
  cleanTask.acceptance = [];
  fs.writeFileSync(taskFile, JSON.stringify(cleanTask));

  const r4 = run('criteria-gate.cjs', {
    cwd: TEST_DIR,
    tool_input: { file_path: path.join(TEST_DIR, 'src', 'app.js') }
  });
  assert('allows write when task is cancelled', r4.exitCode === 0);

  // Restore for subsequent tests
  cleanTask.status = 'active';
  cleanTask.acceptance = ['Criterion A'];
  fs.writeFileSync(taskFile, JSON.stringify(cleanTask));
}

// --- lib.cjs tests ---

function testLib() {
  console.log('\nlib.cjs');

  const lib = require('./lib.cjs');
  assert('sanitizeId removes dots', lib.sanitizeId('../etc') === '___etc');
  assert('sanitizeId keeps valid chars', lib.sanitizeId('task-001_v2') === 'task-001_v2');
  assert('readJSON returns null for missing file', lib.readJSON('/nonexistent/file.json') === null);
  assert('readText returns null for missing file', lib.readText('/nonexistent/file.txt') === null);
}

// --- Run all ---

console.log('mbscode hook test suite\n========================');

testLib();
setup();
testSessionInit();
testTaskInit();
testCompleteGuard();
testCriteriaGate();
testSubagentInject();
testCompactRestore();
cleanup();

console.log(`\n========================`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
