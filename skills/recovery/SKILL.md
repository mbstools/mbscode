---
name: recovery
description: Use when tasks are stuck, state is corrupt, you need to cancel work, manage standing rules, or override verification. Covers all recovery scenarios.
---

# Recovery

## Overview

Things break. Tasks get stuck, requirements change, metadata gets corrupted. This skill covers graceful recovery.

## Cancelling a Task

When a task should be abandoned:

1. Mark the task as cancelled using native task management
2. Update the metadata file with a reason:

```json
// .mbscode/tasks/<task_id>.json
{
  "cancelled_at": "2026-04-11T16:00:00Z",
  "cancel_reason": "User decided to use OAuth instead of custom auth"
}
```

Don't delete the metadata file — cancelled tasks are history.

## Corrupt or Missing Metadata

### Task metadata file missing

If `.mbscode/tasks/<task_id>.json` doesn't exist for an active task, recreate it:

```json
{
  "task_id": "<id>",
  "subject": "reconstructed from task subject",
  "acceptance": ["...reconstruct from memory or git diff..."],
  "owned_paths": ["...check git diff for changed files..."],
  "progress": [
    { "at": "...", "text": "Recovered — original metadata was missing" }
  ]
}
```

Use `git diff` and `git log` to reconstruct what was being worked on.

### context.json is stale

Delete it — the session-init hook will regenerate:

```bash
rm .mbscode/context.json
```

## Managing Standing Rules

### Adding a Rule

Append to `.mbscode/rules.md`:

```markdown
## Documentation
- When database schema changes, update docs/DATABASE.md
```

### Removing a Rule

Edit `.mbscode/rules.md` and remove the line.

### Checking Current Rules

Read `.mbscode/rules.md`. Rules are injected at session start, to subagents, and after compaction. The completion agent checks them.

## Overriding Verification

Sometimes the completion verifier is wrong. Two approaches:

### 1. Adjust the Metadata (Preferred)

If acceptance criteria are wrong, update them. If a doc target doesn't apply, remove it. If owned paths changed, update them. Then try completing again.

### 2. Manual Override (Last Resort)

If the agent is genuinely wrong and work is confirmed correct:

```json
// .mbscode/tasks/<task_id>.json — add override field
{
  "override": {
    "at": "2026-04-11T16:00:00Z",
    "reason": "Agent couldn't verify — no test framework set up yet",
    "verified_by": "human"
  }
}
```

The `override` field documents why verification was skipped. Don't abuse it.

## Post-Compaction Recovery

The compact-restore hook injects state after compaction. If something seems off:

1. Read `.mbscode/rules.md` — rules survive compaction (on disk)
2. Read `.mbscode/tasks/` — task metadata is on disk
3. Read `.mbscode/context.json` — project context is on disk

The `.mbscode/` directory is always the source of truth.

## Starting Fresh

If mbscode state is completely broken:

```bash
rm -rf .mbscode
```

The session-init hook will recreate `.mbscode/` on next session. Task history will be lost.

## Rationalizations vs Reality

| Rationalization | Reality |
|---|---|
| "I'll just delete state and start over" | That loses history. Try recovery first. |
| "Override lets me skip verification" | Override is for exceptions, not convenience. |
| "Compaction lost everything" | State is on disk in .mbscode/. Read it. |
