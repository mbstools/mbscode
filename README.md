# mbscode

Task discipline and semantic verification for Claude Code.

## What It Does

mbscode enforces a simple cycle: **create task → work → complete**.

- Tasks are created with native Claude Code tools (TaskCreate)
- An agent hook verifies task completion by reading actual files
- Standing rules survive compaction and reach every subagent
- Task metadata (acceptance criteria, doc targets) guides verification

## Install

```
/plugin install mbscode@mbstools
/reload-plugins
```

## How It Works

```
Create Task ──── native TaskCreate
│                task-init hook creates .mbscode/tasks/<id>.json
│                fill in: acceptance, doc_targets, owned_paths
│
Work ─────────── implement, test, document
│  ├─ Subagent → subagent-inject hook: rules + task context injected
│  └─ Compact ── restore hook: state survives
│
Complete ─────── mark task complete natively
│                TaskCompleted agent hook verifies:
│                ✓ acceptance criteria (reads code)
│                ✓ docs updated (reads doc files)
│                ✓ tests exist (reads test files)
│                ✓ code quality
│                ✓ standing rules satisfied
│                Fail → blocks, reports findings → fix → retry
│                Pass → task done
```

## File Structure

```
.mbscode/
├── rules.md        — standing user rules (Markdown)
├── context.json    — auto-discovered project context
└── tasks/
    └── <task-id>.json — metadata per task
```

## Skills

| Skill | Purpose |
|-------|---------|
| using-mbscode | Master guide — lifecycle, file formats, hooks |
| planning | Spec → milestones → slices → tasks |
| executing | Disciplined implementation with tracking |
| completing | Task completion, handling verification failures |
| recovery | Cancel, repair, manage rules, override |

## Repository Layout

```
.claude-plugin/   plugin manifest
hooks/            hook configuration and handlers
skills/           5 methodology skills
docs/             philosophy and design rationale
```
