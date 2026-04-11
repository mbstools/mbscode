---
name: completing
description: Use when finishing a task. Covers the pre-completion checklist, what the agent hook verifies, how to handle verification failures, and the fix-retry cycle.
---

# Completing

## Overview

When you mark a task as complete, the TaskCompleted agent hook fires. It reads actual files and verifies your work. If anything is missing, it blocks completion with specific findings.

## Before Completing

Run this checklist mentally:

### 1. Acceptance Criteria
Read `.mbscode/tasks/<task_id>.json` → `acceptance` array.
For each criterion: is it actually done? Can you point to code that proves it?

### 2. Documentation
Read `doc_targets` from the metadata. For each:
- Does the doc exist?
- Does its content reflect your changes?

Read `.mbscode/rules.md` for standing rules about docs:
- If a rule says "update docs/X.md when Y changes" — did you?

### 3. Tests
For each source file in `owned_paths`:
- New behavior added? → Test file should exist and cover it
- Pure refactor? → Existing tests should still pass
- Config/docs only? → No tests needed

### 4. Code Quality
For each file in `owned_paths`:
- No commented-out code blocks
- No debug statements (console.log, print, debugger)
- No unused imports
- Edge cases handled

### 5. Progress & Decisions
Is the progress log current? Are decisions documented?

## Completing the Task

Mark the task as complete using native Claude Code task completion. The TaskCompleted hook fires automatically.

## What the Agent Hook Checks

The completion-verifier agent:

1. **Reads task metadata** — `.mbscode/tasks/<task_id>.json`
2. **Reads standing rules** — `.mbscode/rules.md`
3. **Reads project context** — `.mbscode/context.json`
4. **For each acceptance criterion** — reads source files, confirms from code
5. **For each doc_target** — reads the doc, checks if content is current
6. **For each standing rule about docs** — verifies compliance
7. **For each source file** — checks test coverage
8. **Code quality scan** — dead code, debug statements, YAGNI

## Handling Failures

When the agent blocks completion, it returns specific findings:

```
Task completion blocked:
- [ACCEPTANCE] "Middleware rejects expired tokens" — no expiry check in src/middleware/auth.ts
- [DOCS] docs/API.md doesn't mention the new /auth/verify endpoint
- [TESTS] src/middleware/auth.ts has no corresponding test file
- [RULES] Standing rule: "update docs/DATABASE.md when schema changes" — not satisfied
```

### Fix-Retry Cycle

1. **Read each finding** — understand what's missing
2. **Fix the specific issues** — don't do extra work
3. **Update the task metadata** if needed (new owned_paths, adjusted acceptance)
4. **Try completing again** — the agent re-checks everything

### Common Failure Patterns

| Finding | Fix |
|---------|-----|
| [ACCEPTANCE] criterion not met | Implement the missing behavior |
| [DOCS] doc not current | Update the doc to reflect changes |
| [TESTS] no test file | Write tests for new behavior |
| [CODE] debug statement | Remove console.log/print/debugger |
| [RULES] rule violated | Satisfy the rule or explain in task why it doesn't apply |

### If the Agent is Wrong

Sometimes the agent makes a mistake (e.g., misreads code, false positive on dead code):

1. **Preferred**: Adjust the task metadata — update acceptance, doc_targets, or owned_paths to reflect reality
2. **Last resort**: See "recovery" skill for manual completion with override

## Multiple Attempts

The fix-retry cycle can repeat. Each attempt:
- Agent re-reads all files from scratch
- Previous findings don't carry over — it's a fresh check
- You can fix one issue at a time or all at once

## Rationalizations vs Reality

| Rationalization | Reality |
|---|---|
| "The agent is too strict" | It checks what you defined. Adjust the metadata if criteria are wrong. |
| "I'll fix the docs in the next task" | The agent checks now. Fix now. |
| "These tests aren't necessary" | If there's new behavior, there should be tests. |
| "The agent keeps failing, I'll override" | Fix the issues. Override is for genuine exceptions only. |
