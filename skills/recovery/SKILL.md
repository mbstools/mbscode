---
name: recovery
description: "Handles broken state, cancellations, overrides, and compaction recovery. Use when tasks are stuck, metadata is corrupt, or you need to cancel work."
---

# Recovery

## Overview

Repair broken state by reading `.mbscode/` files on disk. Handles stuck tasks, missing metadata, compaction recovery, cancellations, and verification overrides.

## When to Use

- Task is stuck (can't complete, can't verify)
- Metadata file is missing or corrupt
- Compaction lost your context and you need to reconstruct state
- Task needs to be cancelled
- Override is genuinely needed (last resort)

**When NOT to use:**
- Task is blocked by the verifier with specific findings → go to **completing** (fix findings)
- You're still working → stay in **executing**
- You need to plan new work → go to **planning**

## Decision Tree

```
What went wrong?
│
├── "Verifier keeps rejecting"
│   ├── Findings are valid → fix them (completing skill)
│   ├── Criteria are wrong → update acceptance criteria, re-verify
│   └── Genuine exception → override (see below)
│
├── "Task metadata is missing"
│   └── Reconstruct from git (see below)
│
├── "Context seems wrong after compaction"
│   └── Read .mbscode/ files — state is on disk
│
├── "Need to cancel this task"
│   └── Set status: "cancelled" with reason (see below)
│
├── "context.json is stale"
│   └── Delete it — session-init hook regenerates
│
└── "Everything is broken"
    └── Nuclear: rm -rf .mbscode (see below)
```

## Scenarios

### Cancel a Task

```json
{
  "status": "cancelled",
  "cancelled_at": "2026-04-11T16:00:00Z",
  "cancel_reason": "User switched to OAuth instead of custom JWT"
}
```

Don't delete the file. Cancelled tasks are history — they document decisions.

### Missing Metadata

Reconstruct from available information:

```bash
git diff --name-only          # what files changed
git log --oneline -5          # recent context
```

```json
{
  "task_id": "<id>",
  "subject": "<from task subject>",
  "acceptance": ["<reconstruct from diff or ask user>"],
  "owned_paths": ["<from git diff>"],
  "progress": [{ "text": "RECOVERED — original metadata was missing" }]
}
```

### Stale context.json

Delete it. The session-init hook regenerates it.

```bash
rm .mbscode/context.json
```

### Conflicting Tasks

Two tasks modifying the same files? Resolve:

1. Check which task was created first (task_id order)
2. Check acceptance criteria for overlap
3. Merge into one task if closely related
4. If separate concerns: one task at a time, update owned_paths after each

### Partial Completion

Work is partially done but can't continue (user changed direction, dependency blocked):

1. Log what was completed in progress
2. Log why it can't continue
3. Cancel with a detailed reason
4. Create a new task if work resumes with different scope

### Override Verification

**Preferred:** adjust metadata. Wrong criteria? Update them. Wrong doc_target? Remove it. Re-invoke verifier.

**Last resort:** manual override with documented reason.

```json
{
  "override": {
    "at": "2026-04-11T16:00:00Z",
    "reason": "No test framework configured — testing setup is a separate task",
    "verified_by": "human"
  }
}
```

The hook checks `override.reason` and allows completion.

### Post-Compaction

The `compact-restore` hook injects state automatically. If things seem off:

```
Read .mbscode/rules.md       → rules survive compaction (disk)
Read .mbscode/tasks/          → find active task
Read active task's progress   → what was done before compaction
```

### Nuclear: Start Fresh

```bash
rm -rf .mbscode
```

Session-init hook recreates it. Task history lost. Only if recovery fails.

## Verification

Before leaving recovery:

- [ ] `.mbscode/` directory exists and is readable
- [ ] Active task metadata is valid JSON with all required fields
- [ ] If cancelled: `status: "cancelled"` + `cancel_reason` set
- [ ] If overridden: `override.reason` documents what was checked
- [ ] If reconstructed: progress log notes "RECOVERED"
- [ ] If nuclear: session-init hook regenerated `.mbscode/`

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Just delete and start over" | Loses history. Try recovery first. |
| "Override is faster" | Override is for exceptions, not speed. Fix the issues. |
| "Compaction lost everything" | State is on disk. Read the files. |
| "I'll recreate the task later" | Cancel properly. Future you (or the next session) needs the history. |
| "Metadata doesn't matter, the code is done" | Metadata is what the verifier checks. No metadata = no verification = no completion. |
| "The task is too broken to fix" | Read the files. Most recovery takes under a minute. |

## Red Flags

- Overriding more than once in a project
- Deleting metadata instead of cancelling
- Not reading `.mbscode/` after compaction
- Nuclear option before trying reconstruction
- Cancelling without a reason
- Overriding without documenting what was checked manually
