#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook — fires when a Claude Code session begins.
 *
 * 1. Creates .mbscode/ directory structure
 * 2. Discovers project context (source dirs, docs, manifests)
 * 3. Reads rules and task metadata
 * 4. Injects everything as additionalContext
 */

const { fs, path, ensureDir, readJSON, readText, runHook, mbsDir, tasksDir, listTaskFiles, readTask } = require('./lib.cjs');

const ROOT = process.cwd();

function discoverContext() {
  const context = { source_dirs: [], doc_files: [], manifests: [], has_git: false };

  const candidates = ['src', 'lib', 'app', 'pkg', 'cmd', 'server', 'api', 'core'];
  for (const d of candidates) {
    if (fs.existsSync(path.join(ROOT, d))) context.source_dirs.push(d);
  }

  if (fs.existsSync(path.join(ROOT, 'docs'))) {
    try {
      context.doc_files = fs.readdirSync(path.join(ROOT, 'docs')).filter(e => e.endsWith('.md'));
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

function writeWorkflow(mbs) {
  const wf = path.join(mbs, 'WORKFLOW.md');
  if (fs.existsSync(wf)) return;
  fs.writeFileSync(wf, `# mbscode — Workflow

## Akış

\`\`\`
PLAN ──→ TASK ──→ EXECUTE ──→ VERIFY ──→ COMPLETE
 │        │         │           │           │
 │        │         │           │           └─ task-complete-guard
 │        │         │           │              verified + acceptance → geçir
 │        │         │           │              değilse → BLOKLA
 │        │         │           │
 │        │         │           └─ completion-verifier agent
 │        │         │              dosyaları okur, 8 adım kontrol
 │        │         │
 │        │         └─ criteria-gate hook
 │        │            acceptance boşsa Write/Edit → BLOKLA
 │        │
 │        └─ task-init hook
 │           metadata iskeleti + "criteria doldur" uyarısı
 │
 └─ planning skill
    araştır → öner → onay al → doküman planla → decompose
\`\`\`

## Enforcement Noktaları

| Hook              | Event              | Bloklar? | Ne yapar                          |
|-------------------|--------------------|---------:|-----------------------------------|
| session-init      | SessionStart       |    Hayır | .mbscode/ oluştur, context inject |
| task-init         | TaskCreated        |    Hayır | Metadata iskeleti + STOP uyarısı  |
| criteria-gate     | PreToolUse (W/E)   |     EVET | Boş acceptance → kod yazma engeli |
| subagent-inject   | SubagentStart      |    Hayır | Rules + task context inject       |
| compact-restore   | PostCompact        |    Hayır | State yeniden inject              |
| complete-guard    | TaskCompleted      |     EVET | verified + acceptance kontrolü    |

## Verifier 8 Adım

| # | Adım              | Kontrol                                       |
|---|--------------------|-------------------------------------------------|
| 1 | Read Inputs        | Metadata + rules oku                            |
| 2 | Check Metadata     | acceptance boş mu?                              |
| 3 | Acceptance         | Her kriter → kodu bul → doğrula                |
| 4 | Documentation      | Dokümanlar güncel mi? Eksik doc var mı?         |
| 5 | Tests              | Yeni davranış için test var mı?                 |
| 6 | Code Cleanliness   | Debug artifact, dead code, empty catch          |
| 7 | Code Structure     | Simple / Clean / Extensible                     |
| 8 | Decide             | 0 bulgu → pass, bulgu varsa → fail              |

## Skill Yönlendirme

| Durum                          | Skill        |
|--------------------------------|--------------|
| Yeni istek, plan yapılacak     | planning     |
| Task var, kod yazılacak        | executing    |
| Bug var, neden bilinmiyor      | debugging    |
| İş bitti, kapatılacak          | completing   |
| Task stuck, metadata bozuk     | recovery     |
| mbscode nasıl çalışır?         | using-mbscode|

## Doküman Standartları

| Proje tipi        | Gerekli doküman                              |
|-------------------|----------------------------------------------|
| CLI tool          | README.md — kurulum + her komutun kullanımı  |
| API               | README.md + API.md — her endpoint detaylı    |
| Database kullanan | DATABASE.md — şema, tablolar, ilişkiler      |
| Library           | README.md — kurulum, kullanım, API referans  |
| Full-stack        | README.md + API.md + DATABASE.md             |

Dokümanlar kod ile birlikte yazılır. Sonraya bırakılmaz.
doc_targets'ta listelenir. Verifier kontrol eder.
`);
}

runHook('SessionStart', () => {
  const mbs = mbsDir(ROOT);
  ensureDir(mbs);
  ensureDir(tasksDir(ROOT));

  // Write workflow reference on first init
  writeWorkflow(mbs);

  // Always refresh context on session start
  const context = discoverContext();
  fs.writeFileSync(path.join(mbs, 'context.json'), JSON.stringify(context, null, 2));

  const rules = readText(path.join(mbs, 'rules.md'));
  const taskFiles = listTaskFiles(ROOT);

  const parts = [
    '[mbscode] Active — task discipline enforced.',
    '',
    'MANDATORY WORKFLOW — you must follow this order for ALL work:',
    '',
    '1. PLAN: Before writing ANY code, analyze the request:',
    '   - Read the existing codebase (grep, glob, read files)',
    '   - Research unfamiliar technology (web search, read docs)',
    '   - Propose your approach to the user with concrete examples',
    '   - Ask questions with specific proposals, never open-ended',
    '   - Get user approval before proceeding',
    '',
    '2. TASK: Create a task via TaskCreate, then IMMEDIATELY fill .mbscode/tasks/<id>.json:',
    '   - acceptance: specific, code-verifiable criteria (NEVER leave empty)',
    '   - owned_paths: files you will create or modify',
    '   - doc_targets: existing docs that your changes affect (README, API docs, etc.)',
    '   ⚠ DO NOT write any code until acceptance criteria are filled',
    '   ⚠ If the project has docs (README.md, etc.), check if your changes require updating them',
    '',
    '3. EXECUTE: Write code within task scope:',
    '   - Simple: no function >50 lines, no premature abstractions',
    '   - Clean: no magic values, separate concerns, match existing patterns',
    '   - Extensible: no hardcoded deps, use maps for 4+ cases',
    '   - Log progress in task metadata after each meaningful step',
    '',
    '4. VERIFY: Before completing, invoke the completion-verifier agent:',
    '   - Self-check first (acceptance, docs, tests, code structure)',
    '   - Run: "Verify task <id> for completion"',
    '   - Fix any findings, re-verify until pass',
    '   - Set verified: true, then mark task complete',
    '   ⚠ The TaskCompleted hook BLOCKS unless verified: true + acceptance non-empty',
    '',
    'CRITICAL RULES:',
    '- Never write code before acceptance criteria exist in the task metadata',
    '- Never skip the planning step, even for "simple" tasks',
    '- Never fill acceptance criteria retroactively after coding'
  ];

  if (taskFiles.length > 0) {
    parts.push(`\n## Task metadata files: ${taskFiles.length}`);
    for (const tf of taskFiles.slice(0, 5)) {
      const task = readTask(ROOT, tf);
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
    parts.push('⚠ If your changes affect any of these docs, add them to doc_targets and update them alongside code.');
  }

  if (context.source_dirs?.length) {
    parts.push(`## Source dirs: ${context.source_dirs.join(', ')}`);
  }

  return { additionalContext: parts.join('\n') };
});
