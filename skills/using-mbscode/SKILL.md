---
name: using-mbscode
description: Master guide for the mbscode framework. Use this skill when starting a session, when unsure how mbscode works, or when you need to understand the lifecycle, file formats, or hook behavior.
---

# Using mbscode

## Overview

mbscode enforces disciplined development through **skills that teach** and **hooks that verify**. Every change needs a task. Tasks are created with native Claude Code tools. An agent hook verifies work at completion.

Philosophy: "Polis değil, PM." — Not police, but project manager.

## Lifecycle

```
User Request
│
├─ Ambiguous? → Ask questions one at a time
├─ Clear? → Plan: milestones → slices → tasks
│
├─ Create Task → native TaskCreate
│   TaskCreated hook → creates .mbscode/tasks/<id>.json skeleton
│   Fill in acceptance criteria, doc_targets, owned_paths
│
├─ Work → implement, test, document
│   ├─ Log progress in task metadata
│   ├─ Log decisions with reasoning
│   ├─ Research before implementing
│   └─ Write simplest correct solution
│
├─ Complete Task → mark task complete natively
│   TaskCompleted agent hook verifies:
│   ✓ Acceptance criteria met (reads code)
│   ✓ Docs updated (reads doc files)
│   ✓ Tests exist (reads test files)
│   ✓ Code quality check
│   ✓ Standing rules satisfied
│   Fail → blocks, reports findings → fix → retry
│   Pass → task done
│
└─ Next Task → pick from plan
```

## File Structure

```
.mbscode/
├── rules.md        — standing user rules (Markdown)
├── context.json    — auto-discovered project context
└── tasks/
    └── <task-id>.json — metadata per task
```

### Task Metadata

Created automatically by TaskCreated hook. Fill in the fields:

```json
{
  "task_id": "task-001",
  "subject": "Add JWT auth middleware",
  "status": "active",
  "acceptance": [
    "Middleware rejects expired tokens with 401",
    "Protected routes require valid Bearer token"
  ],
  "doc_targets": ["docs/API.md"],
  "owned_paths": ["src/middleware/auth.ts"],
  "directives": ["Use RS256"],
  "progress": [],
  "decisions": []
}
```

### Standing Rules (rules.md)

```markdown
## Documentation
- When schema changes, update docs/DATABASE.md

## Code
- Use camelCase for variables
```

Injected at: session start, subagent start, after compaction. Checked at task completion.

## Hooks

| Hook | Event | Effect |
|------|-------|--------|
| session-init | SessionStart | Creates .mbscode/, injects rules + context |
| task-init | TaskCreated | Creates metadata skeleton |
| completion-verifier | TaskCompleted | Agent verifies everything |
| subagent-inject | SubagentStart | Injects rules + task context to subagents |
| compact-restore | PostCompact | Restores state after compaction |

## Quick Reference

| Need to... | Do this |
|---|---|
| Create a task | Native TaskCreate → fill .mbscode/tasks/<id>.json |
| Add a rule | Write to .mbscode/rules.md |
| Complete a task | Mark complete natively → agent verifies |
| Cancel a task | See "recovery" skill |

## Rationalizations vs Reality

| Rationalization | Reality |
|---|---|
| "Small change, no task needed" | Agent hook checks at completion. No task = no verification. |
| "I'll fill metadata later" | Agent hook reads metadata. Empty = nothing to check. |
| "Rules don't apply here" | Agent hook checks all rules. Explain exceptions in the task. |
