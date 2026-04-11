---
name: executing
description: Use during active implementation. Covers disciplined coding, progress logging, decision tracking, scope management, research-first approach, and code quality standards.
---

# Executing

## Overview

You have a task with acceptance criteria. Now implement it with discipline.

## Before Writing Code

1. **Read the task metadata** — `.mbscode/tasks/<task_id>.json`
   - What are the acceptance criteria?
   - What docs need updating?
   - What files will you change?

2. **Read standing rules** — `.mbscode/rules.md`
   - Any doc obligations?
   - Any code style rules?

3. **Research if needed** — don't guess
   - Unfamiliar technology? Web search first.
   - Multiple approaches? Compare before choosing.
   - The simplest correct solution is always best.

## While Working

### Log Progress

After each meaningful step, update the task metadata:

```json
{
  "progress": [
    { "at": "2026-04-11T15:00:00Z", "text": "Created auth middleware with RS256 validation" },
    { "at": "2026-04-11T15:20:00Z", "text": "Added tests for expired/invalid/missing tokens" },
    { "at": "2026-04-11T15:30:00Z", "text": "Updated docs/API.md with auth header requirements" }
  ]
}
```

Why? Progress survives compaction (it's on disk). If context is lost, you know what was done.

### Log Decisions

When you choose between alternatives:

```json
{
  "decisions": [
    {
      "at": "2026-04-11T15:05:00Z",
      "choice": "RS256 over HS256",
      "reason": "Supports key rotation, industry standard for production"
    }
  ]
}
```

### Stay in Scope

The task defines what you're doing. Everything else is out of scope:

- **Related bug found?** → Note it in progress, create a new task later
- **Better approach for unrelated code?** → Note it, don't refactor now
- **User adds new requirement?** → If it fits the task, update acceptance. If not, new task.

### Update owned_paths

If you end up touching files not in `owned_paths`, update the metadata. The agent hook uses this list to check code quality.

## Code Quality Standards

These apply to every task, every project:

1. **Simplest correct solution** — no premature abstraction, no YAGNI violations
2. **No dead code** — remove commented-out blocks, unused imports
3. **No debug artifacts** — no console.log, print(), debugger statements in production code
4. **Edge cases handled** — null checks, empty arrays, error paths
5. **Tests for behavior** — new behavior needs tests. Refactors of tested code don't.
6. **Docs reflect reality** — if you change an API, the docs must match

## Working with Subagents

When dispatching subagents:
- The subagent-inject hook automatically provides standing rules and project context
- Give subagents clear, specific prompts
- Review subagent output — they can make mistakes too

## Rationalizations vs Reality

| Rationalization | Reality |
|---|---|
| "I'll log progress later" | Compaction can happen any time. Log now. |
| "This refactor is in scope" | If it's not in acceptance criteria, it's not in scope. |
| "No need to research, I know this" | Technologies change. A 30-second search can reveal new best practices. |
| "Tests slow me down" | Agent hook checks for tests. Writing them now saves a rejection cycle. |
| "Docs can wait until the end" | Write docs alongside code. Context is freshest now. |
| "This dead code might be useful" | Delete it. Git has history. |

## Verification

While working, regularly check:
- [ ] All acceptance criteria are being addressed
- [ ] Progress log is current
- [ ] Decisions are documented
- [ ] No scope creep
- [ ] Standing rules are being followed
- [ ] Code quality standards met
