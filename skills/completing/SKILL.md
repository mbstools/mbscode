---
name: completing
description: "Guides the verify-and-close flow. Use when work is done and you're ready to complete a task, or when the TaskCompleted hook blocked you."
---

# Completing

## Overview

Self-check your work against the verifier's 8 steps, invoke the completion-verifier agent, fix any findings, then close the task. The hook blocks completion until the agent passes.

## When to Use

- All acceptance criteria are implemented and you're ready to close the task
- The TaskCompleted hook blocked you ("not verified")
- The verifier returned findings and you've fixed them, ready to retry

**When NOT to use:**
- You're still implementing → stay in **executing**
- You know there are gaps → fix them first, then come here
- Task is stuck or needs cancellation → go to **recovery**

## Self-Check First

Don't waste an agent invocation on known gaps. The verifier runs 8 steps. Steps 1-2 are internal (metadata parsing). Steps 3-8 check your work. Check them yourself first:

### Acceptance Criteria (verifier step 3)

Read `acceptance` in your task metadata. For each criterion, can you point to the exact file and line that implements it? If not, it will fail.

### Documentation (verifier step 4)

Read `doc_targets`. Open each doc. Does it reflect what you actually built? Not "does it exist" — does the **content** match your changes?

Check `rules.md` for "When X changes, update Y" rules. Did X change? Is Y updated?

### Tests (verifier step 5)

For each source file in `owned_paths` — does a test file exist? Does it test the **new** behavior, not just old behavior?

Skip this check if your task only touches config, docs, or markdown files.

### Code Cleanliness (verifier step 6)

Scan your code for surface issues:

- `console.log`, `debugger`, `print("DEBUG")` → remove
- Commented-out code blocks (3+ lines) → delete, git has history
- `catch (e) {}` with no explanation → handle or comment why
- `// TODO: add validation` for something in your acceptance criteria → do it now

### Code Structure (verifier step 7)

This is the most common rejection reason. The verifier checks three dimensions:

**Simplicity** — read each function/class you wrote:

- **Is any function longer than ~50 lines?** → it's doing too much, split by concern
- **Is there a class/interface used by exactly one caller?** → premature abstraction, a plain function is simpler
- **Is there a Strategy/Factory/Builder for a single use case?** → over-engineering, delete the pattern
- **Is nesting deeper than 3 levels?** → use early returns or extract helpers
- **Is there a wrapper function that adds nothing?** → unnecessary indirection, remove it

**Cleanliness** — scan for structural dirt:

- **Any magic numbers/strings?** `if (retries > 3)`, `setTimeout(cb, 86400000)` → name them: `MAX_RETRIES`, `MS_PER_DAY`
- **Any function mixing concerns?** HTTP parsing + business logic + database in one place → separate them
- **Does new code match existing patterns?** Callbacks in a promise-based codebase → match the codebase
- **Any dead parameters?** Function accepts something it never uses → remove
- **Same 5+ line block copy-pasted?** → extract into a shared function

**Extensibility** — check for future pain:

- **Hardcoded dependencies inside functions?** DB connection string, API URL baked in → pass as parameter or read from config
- **4+ cases in an if/else chain?** → use a map or registry so new cases don't require modifying this code
- **Module A calling Module B's internals?** → tight coupling, use B's public interface
- **Error messages just say "Failed"?** → say what failed, why, and what to check

**Balance:** Don't over-engineer for extensibility. 2 cases don't need a registry. A utility used once doesn't need dependency injection. Only fix this if the complexity is already there.

---

If anything fails in these checks, **fix it before calling the agent.** A 2-minute self-check saves a 5-minute failed verification cycle.

## Invoke the Verifier

```
"Verify task <task_id> for completion."
```

The agent reads your actual files — acceptance criteria against source code, docs against changes, test files against new behavior, standing rules against project state.

**Pass** → proceed. **Fail** → fix findings, invoke again.

## Set Verified and Complete

After the agent passes:

```json
// .mbscode/tasks/<id>.json
{ "verified": true }
```

Then mark the task complete. The hook checks `verified: true` + acceptance non-empty → allows completion.

## Fix-Retry Cycle

When the agent returns findings:

```
❌ Task blocked:
- [ACCEPTANCE] "Rejects expired tokens" — no expiry check in auth.ts:22
- [DOCS] docs/API.md missing POST /auth/verify endpoint
- [TESTS] src/services/token.ts has no test file
- [STRUCTURE] src/routes/users.ts:createUser() — 87 lines, mixes validation,
  hashing, DB insert, email sending. Split by concern.
- [STRUCTURE] src/config.ts:12 — hardcoded "mongodb://localhost:27017",
  should be environment variable or config parameter
- [QUALITY] src/utils/retry.ts:8 — magic number `if (attempts > 3)`,
  use named constant MAX_RETRY_ATTEMPTS
```

1. Fix each finding specifically. Don't guess — the agent told you exactly what's wrong.
2. Update metadata if needed (new owned_paths, adjusted acceptance).
3. Invoke the agent again — it re-checks from scratch.
4. All clear → set verified → complete.

**Don't argue with findings. Fix them or adjust your criteria.**

## When the Agent Is Wrong

The verifier checks what YOU defined. If it rejects something unfairly:

1. **Adjust metadata** (preferred) — wrong criteria? Update them. Wrong doc_target? Remove it. Overly specific criterion? Rewrite it. Re-invoke verifier.
2. **Override** (last resort) — add `override: { reason: "..." }` to metadata. See **recovery** skill.

## Verification

Before marking the task complete:

- [ ] Self-check passed for all verifier steps (3-7)
- [ ] Completion-verifier agent invoked and returned pass
- [ ] `verified: true` set in task metadata
- [ ] `acceptance` is non-empty
- [ ] Progress log reflects all meaningful work done

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Agent is too strict" | It checks what YOU defined. Wrong criteria? Update them. |
| "I'll fix docs next task" | Verifier checks now. Fix now. |
| "Agent keeps failing, I'll override" | Fix the issues. Override is for genuine exceptions. |
| "Self-check is a waste of time" | A 30-second self-check saves a multi-minute failed verification. |
| "I already know it passes" | Then the agent will confirm in seconds. Invoke it anyway. |
| "Just this once without verification" | The hook will block you. There is no "just this once." |
| "The structure is fine, it works" | Working code and clean code are different things. The verifier checks both. |
| "Refactoring the function is out of scope" | If YOU wrote the 80-line god function in this task, splitting it IS in scope. |
| "It's just one magic number" | Name it. 10 seconds now saves confusion for every future reader. |

## Red Flags

- Setting `verified: true` without invoking the agent
- Overriding more than once in a project
- Completing with empty progress log
- Rushing without self-check → agent rejection costs more time
- Multiple fix-retry cycles for the same finding → you're not reading the finding carefully
- Adjusting acceptance criteria to avoid fixing code → criteria should reflect requirements, not convenience
