---
name: debugging
description: "Systematic debugging without guesswork. Use when behavior is wrong, a task is blocked by a failure, or when the cause of a problem is unknown."
---

# Debugging

## Overview

Find the root cause through systematic investigation: reproduce, isolate, diagnose, fix, verify. Never guess — every fix must be backed by a confirmed diagnosis.

## When to Use

- A test fails and you don't know why
- Code produces wrong output
- An error occurs during implementation
- A verifier finding doesn't make sense (code looks correct but behavior is wrong)
- Something "worked before" and now doesn't

**When NOT to use:**
- You already know the cause → just fix it
- The error message tells you exactly what's wrong → just fix it
- You're implementing new code, not fixing broken code → go to **executing**

## The Debugging Loop

```
Reproduce → Isolate → Diagnose → Fix → Verify
    ▲                                    │
    └────────── if fix doesn't work ─────┘
```

**Never skip steps.** A fix without reproduction is a guess. A guess without verification is a hope.

### 1. Reproduce

Make the bug happen consistently. If you can't reproduce it, you can't verify the fix.

```
What I expected: POST /users returns 201 with user object
What happened:   POST /users returns 500 with "Cannot read property 'id' of undefined"
Steps:           1. POST /users with {"name": "test", "email": "a@b.com"}
                 2. Response: 500
```

**Log it in progress:**
```json
{ "text": "BUG: POST /users returns 500 — 'Cannot read property id of undefined'" }
```

If you can't reproduce: check environment differences, input variations, race conditions. Ask the user for reproduction steps if needed.

### 2. Isolate

Narrow down where the bug lives. Don't read the entire codebase — find the specific location.

**Strategy: work backward from the error.**

```
Error at:     src/routes/users.ts:45 — user.id is undefined
Called from:  src/routes/users.ts:38 — const user = await createUser(body)
Root:         src/services/user.ts:12 — createUser returns null on duplicate email
                                         but caller expects user object
```

Tools to use:
- **Read** the stack trace / error output
- **Grep** for the function, variable, or error message
- **Read** the specific file and surrounding context
- **Check git log** for recent changes to the affected file

**Don't:**
- Read every file in the project
- Guess based on file names
- Assume the bug is where the error surfaces (it's often one level deeper)

### 3. Diagnose

You've found the location. Now understand **why** it fails.

Ask: what does the code actually do vs. what should it do?

```
createUser() at user.ts:12:
  - Checks if email exists → if yes, returns null
  - Caller at users.ts:38 doesn't handle null
  - BUG: Missing null check after createUser()

Root cause: createUser returns null for duplicates instead of throwing,
and the caller assumes it always returns a user object.
```

**Log the diagnosis:**
```json
{
  "text": "DIAGNOSED: createUser returns null on duplicate email, caller doesn't handle null. Fix: either throw from createUser or handle null in caller."
}
```

### 4. Fix

Fix the **root cause**, not the symptom.

```typescript
// ✗ Symptom fix — masks the real problem
const user = await createUser(body);
if (!user) user = { id: 'unknown' }; // ???

// ✓ Root cause fix — handles the actual case
const user = await createUser(body);
if (!user) {
  return res.status(409).json({ error: 'Email already registered' });
}
```

**Minimal fix principle:** change only what's needed to fix the bug. Don't refactor, don't "improve" surrounding code, don't add features.

### 5. Verify

Confirm the fix works **and** doesn't break other things.

```
✓ POST /users with new email → 201 with user object (original bug fixed)
✓ POST /users with duplicate email → 409 with error message (root cause handled)
✓ GET /users still works (no regression)
✓ Existing tests pass
```

**If the fix introduces a test:** write it. The verifier will check.

**If the fix doesn't work:** go back to step 1. You misdiagnosed — the bug is somewhere else.

## The Prove-It Pattern (for known bugs)

When a bug is reported with clear reproduction steps:

1. **Write a test that demonstrates the bug** — this test must FAIL
2. **Confirm it fails** — if it passes, your test is wrong
3. **Fix the code** — make the test pass
4. **Run all tests** — confirm no regressions

This pattern guarantees you actually fixed the bug, not something else.

```
1. Write test: "POST /users with duplicate email returns 409"
2. Run test → FAILS (returns 500) ✓ bug confirmed
3. Fix createUser null handling
4. Run test → PASSES ✓ bug fixed
5. Run all tests → all pass ✓ no regression
```

## Multiple Potential Causes

When the root cause isn't obvious:

1. List all hypotheses
2. Test the most likely one first
3. If wrong, cross it off and test the next
4. Don't test multiple hypotheses at once (you won't know which fix worked)

```json
{
  "text": "HYPOTHESES: (1) createUser returns null on duplicate — CONFIRMED. (2) DB connection timeout — ruled out. (3) Validation strips email — not tested, not needed."
}
```

## Verification

Before leaving this skill and returning to **executing**:

- [ ] Bug is reproducible with clear steps
- [ ] Root cause is identified and logged in progress
- [ ] Fix addresses root cause, not symptoms
- [ ] Original reproduction case now works correctly
- [ ] No regressions in existing tests
- [ ] If new test was written, it fails without the fix and passes with it

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I think I know what's wrong" | Then reproduce it and prove it. Thinking is not knowing. |
| "Let me just try this quick fix" | A fix without diagnosis is a guess. Guesses create new bugs. |
| "It works now, I don't know why" | If you don't know why it works, you don't know if it's fixed. Find the cause. |
| "It's probably a library bug" | 95% of bugs are in your code. Check your code first. |
| "Let me rewrite this whole function" | Fix the bug. Rewrites are scope creep disguised as debugging. |
| "I'll add more logging and try again" | Strategic logging is fine. Shotgun logging is guessing with extra steps. |
| "The error message is misleading" | The error message is data. Read it carefully before dismissing it. |

## Red Flags

- Changing code without reproducing the bug first
- Multiple code changes between test runs (you won't know what fixed it)
- "Let me try..." without a hypothesis
- No progress log entries during debugging
- Fixing symptoms instead of root causes
- Debugging for 15+ minutes without isolating the location
- Rewriting instead of fixing
