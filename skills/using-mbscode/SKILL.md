---
name: using-mbscode
description: "Master reference for the mbscode framework. Use when starting a session, when unsure how mbscode works, or when you need to look up file formats, hook behavior, or lifecycle."
---

# Using mbscode

## Overview

Master reference for mbscode. Covers the full lifecycle, all file formats, hook behavior, skill discovery, and core operating behaviors that every other skill inherits.

## When to Use

- Starting a new session and need to understand mbscode
- Unsure which skill applies to your current situation
- Need to look up file formats, hook behavior, or lifecycle
- Another skill references this one

**When NOT to use:** You already know what to do and which skill applies — go directly to that skill.

## Core Operating Behaviors

These are non-negotiable. Every skill inherits them.

1. **Surface assumptions explicitly.** Before proceeding with any non-trivial decision, state what you're assuming and why. Don't silently guess.

2. **Manage confusion actively.** When stuck or uncertain: STOP. Name the confusion. Present options to the user. Wait for resolution. Don't silently guess and proceed.

3. **Push back when warranted.** If the user's request contradicts best practices, say so with reasoning. Sycophancy is a failure mode — agreeing with everything is not helpfulness.

4. **Enforce simplicity.** If you build 1000 lines and 100 would suffice, you have failed. The simplest correct solution wins. Three similar lines beat a premature abstraction.

5. **Maintain scope discipline.** Touch only what you're asked to touch. If you notice something outside scope, log it as `NOTICED:` and move on. Don't fix it. Don't refactor it.

6. **Verify, don't assume.** "Seems right" is never sufficient. Read the file. Run the test. Check the output. If you didn't verify it, you don't know it.

## Skill Discovery

Use this decision tree when you're not sure which skill to use:

```
What are you trying to do?
│
├── "I need to understand or plan work"
│   ├── Work is unclear, needs decomposition → planning
│   └── Work is clear, has acceptance criteria → executing
│
├── "I'm implementing code"
│   ├── I have a task with acceptance criteria → executing
│   └── I don't have a task yet → planning (create one first)
│
├── "I'm debugging a problem"
│   └── → debugging
│
├── "I'm done, ready to close"
│   └── → completing
│
├── "Something is broken/stuck"
│   ├── Task is stuck or metadata is corrupt → recovery
│   ├── Compaction lost my context → recovery (read .mbscode/ files)
│   └── Need to cancel a task → recovery
│
└── "I don't know what to do"
    └── Read this skill (using-mbscode) again
```

## Lifecycle

```
Plan → Create Task → Fill Metadata → Work → Verify → Complete → Next
```

| Step | You | System |
|------|-----|--------|
| Plan | Decompose work, write acceptance criteria | — |
| Create | `TaskCreate` with subject + description | `task-init` hook writes `.mbscode/tasks/<id>.json` skeleton |
| Fill | Edit JSON: acceptance, doc_targets, owned_paths | — |
| Work | Code, test, document, log progress | `subagent-inject` gives subagents your rules + context |
| Debug | Reproduce → isolate → diagnose → fix → verify | — |
| Verify | "Verify task X" → completion-verifier agent | Agent reads files, checks everything |
| Complete | Mark task done | `task-complete-guard` blocks if `verified ≠ true` |

## Files

```
.mbscode/
├── rules.md           ← standing rules (you write, agent checks)
├── context.json       ← project context (hook generates, don't edit)
└── tasks/
    └── <id>.json      ← task metadata (hook creates skeleton, you fill)
```

### Task Metadata

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
  "owned_paths": ["src/middleware/auth.ts", "tests/middleware/auth.test.ts"],
  "directives": ["Use RS256"],
  "progress": [],
  "decisions": [],
  "verified": false
}
```

`acceptance` is required. Empty acceptance = can't complete. The verifier reads these criteria, then reads your code to check each one.

`doc_targets` = docs that must reflect your changes. Verifier reads them.

`owned_paths` = files this task touches. Verifier checks quality + tests.

### Standing Rules

```markdown
## Documentation
- When database schema changes, update docs/DATABASE.md

## Code Style
- All exported functions must have JSDoc comments
```

Injected at session start, to subagents, after compaction. Verifier checks them.

## Hooks

| Hook | Event | Blocks? | Does What |
|------|-------|---------|-----------|
| `session-init` | SessionStart | No | Creates `.mbscode/`, discovers project, injects rules |
| `task-init` | TaskCreated | No | Creates metadata skeleton |
| `task-complete-guard` | TaskCompleted | **Yes** | Blocks unless `verified: true` + acceptance non-empty |
| `subagent-inject` | SubagentStart | No | Injects rules + task context |
| `compact-restore` | PostCompact | No | Restores state after compaction |

When `task-complete-guard` blocks, it tells you which task (id + subject) and instructs you to invoke the completion-verifier agent.

## Quick Reference

| Do this | How |
|---------|-----|
| Create a task | `TaskCreate` → fill `.mbscode/tasks/<id>.json` |
| Add a rule | Append to `.mbscode/rules.md` |
| Complete a task | Invoke verifier → set `verified: true` → mark complete |
| Cancel a task | Set `status: "cancelled"` + `cancel_reason` in metadata |
| Override verification | Add `override: { reason: "..." }` — last resort only |
| Debug a problem | Use debugging skill: reproduce → isolate → diagnose → fix → verify |

## Verification

Before starting any work:

- [ ] Correct skill identified via discovery tree
- [ ] Active task exists (or about to be created via planning)
- [ ] `.mbscode/` directory exists and rules.md is read
- [ ] Core operating behaviors understood (surface assumptions, manage confusion, verify don't assume)

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I don't need mbscode for this" | No task = no verification = no discipline. Even trivial work benefits from tracking. |
| "I'll figure out the skill later" | Use the discovery tree above. It takes 5 seconds. |
| "I know how mbscode works" | Then use it. Knowing is not doing. |
| "The overhead isn't worth it" | 10 seconds to create a task. The verifier catches real gaps. |

## Red Flags

- Working without an active task
- Skipping acceptance criteria ("I'll fill them later")
- Not logging progress during long implementations
- Completing tasks without invoking the verifier
- Ignoring standing rules
