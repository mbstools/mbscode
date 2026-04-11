---
name: executing
description: "Guides disciplined implementation. Use when you have a task with acceptance criteria and are coding, testing, or documenting."
---

# Executing

## Overview

Implement a task within its acceptance criteria. Write simple, clean, extensible code. Log progress and decisions. The completion-verifier will check your work against real files — everything you skip becomes a rejection.

## When to Use

- You have a task with filled acceptance criteria
- You're coding, testing, or documenting against a task
- You're resuming work after compaction (read progress log first)

**When NOT to use:**
- No task exists yet → go to **planning** first
- You're debugging a problem → go to **debugging**
- Work is done, ready to close → go to **completing**
- Task is stuck or broken → go to **recovery**

## Before Writing Code

Read three things:

```
.mbscode/tasks/<id>.json  → what you need to deliver
.mbscode/rules.md         → standing obligations
the codebase              → existing patterns to match
```

If the technology is unfamiliar, research first. Read official documentation. A 30-second search prevents a 30-minute wrong implementation.

## Scope Discipline

The acceptance criteria define your scope. Everything else is off-limits.

When you notice something outside scope:

```json
{ "text": "NOTICED: User model has no email validation — separate task needed" }
```

Don't fix it. Don't refactor it. Don't "quickly" improve it. Log it, move on.

**In scope:** anything in your acceptance criteria, anything blocking your criteria.
**Out of scope:** everything else.

## Code Structure: Simple, Clean, Extensible

The verifier checks these. Write code that passes from the start.

### Simple

> "What's the simplest thing that works correctly?"

```typescript
// ✓ Direct, clear, standard
function validateToken(token: string): JwtPayload {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}

// ✗ Premature abstraction for one algorithm
class TokenValidationContext {
  private strategy: ValidationStrategy;
  constructor(factory: ValidationStrategyFactory) {
    this.strategy = factory.createStrategy('RS256');
  }
  validate(token: string): JwtPayload {
    return this.strategy.execute(token);
  }
}
```

**Rules:**
- Three similar lines beat a premature abstraction. Generalize at the third use case, not the first.
- If a function exceeds ~50 lines, it's doing too much. Split by concern.
- If nesting exceeds 3 levels, use early returns or extract helpers.
- If a class has one method, it should be a function.
- If an abstraction has one implementation, delete the abstraction.

### Clean

```typescript
// ✗ Magic values, mixed concerns
async function createUser(req, res) {
  if (req.body.name.length > 50) return res.status(400).send('Bad');
  const hash = await bcrypt.hash(req.body.password, 12);
  const user = await db.query('INSERT INTO users...', [req.body.name, hash]);
  await fetch('https://api.mail.com/send', { body: JSON.stringify({to: user.email}) });
  res.json(user);
}

// ✓ Named constants, separated concerns, clear error messages
const MAX_NAME_LENGTH = 50;
const BCRYPT_ROUNDS = 12;

async function createUser(req, res) {
  const input = validateUserInput(req.body);      // validation
  const user = await userService.create(input);    // business logic
  await emailService.sendWelcome(user.email);      // side effect
  res.status(201).json(user);                      // response
}
```

**Rules:**
- No magic numbers/strings — use named constants or config.
- One function, one concern — don't mix HTTP, business logic, and I/O in one place.
- Match existing patterns — if the codebase uses promises, don't introduce callbacks.
- No dead parameters — if a function accepts it, it should use it.
- Copy-paste is OK for 2 occurrences. At 3+, extract.

### Extensible

```typescript
// ✗ Closed — adding Telegram means modifying this function
function notify(channel: string, msg: string) {
  if (channel === 'email') sendEmail(msg);
  else if (channel === 'sms') sendSMS(msg);
  else if (channel === 'push') sendPush(msg);
  else if (channel === 'slack') sendSlack(msg);
  else if (channel === 'webhook') sendWebhook(msg);
}

// ✓ Open — adding Telegram means adding one entry
const notifiers: Record<string, (msg: string) => void> = {
  email: sendEmail, sms: sendSMS, push: sendPush,
  slack: sendSlack, webhook: sendWebhook,
};
function notify(channel: string, msg: string) {
  const fn = notifiers[channel];
  if (!fn) throw new Error(`Unknown channel: ${channel}`);
  fn(msg);
}
```

**Rules:**
- Don't hardcode dependencies inside functions — pass them or read from config.
- If you have 4+ cases in a switch/if-else, use a map or registry.
- Error messages should say what failed and why — `'Failed'` helps nobody.
- Don't over-engineer for extensibility. 2 cases don't need a registry. Only add structure when complexity demands it.

## When You're Stuck

Don't silently guess. Follow this protocol:

1. **STOP.** Acknowledge you're stuck.
2. **Name it.** What specifically is unclear? ("I don't know how the existing auth middleware chains" not "this is confusing")
3. **Try to resolve.** Read more code, grep for patterns, check docs.
4. **If still stuck:** Present options to the user with trade-offs. Don't pick one and hope.

```
STUCK: The existing middleware uses both Express and Fastify patterns.
Option A: Follow Express pattern (matches src/middleware/*.ts)
Option B: Follow Fastify pattern (matches src/plugins/*.ts)
I need clarity on which framework this project is migrating toward.
```

## Code Quality

The verifier flags these — handle them during implementation, not after:

```
✗ console.log("DEBUG", token)     → debug artifact in production code
✗ // function oldAuth() { ... }   → commented-out code block (3+ lines)
✗ catch (e) {}                    → empty error handling with no explanation
✗ // TODO: add validation         → leftover TODO for work in this task's scope
```

Not flagged: naming style, formatting, preferences. The verifier checks substance, not taste.

## Progress and Decisions

**Progress** — log after each meaningful step. Survives compaction.

```json
{
  "progress": [
    { "at": "...", "text": "Created auth middleware with RS256 validation" },
    { "at": "...", "text": "Added tests: valid, expired, malformed, missing token" },
    { "at": "...", "text": "Updated docs/API.md with auth header requirements" }
  ]
}
```

**Decisions** — log when you choose between alternatives.

```json
{
  "decisions": [
    { "at": "...", "choice": "RS256 over HS256", "reason": "Supports key rotation, user confirmed" }
  ]
}
```

## Docs Alongside Code

Documentation is part of the deliverable, not an afterthought. Write docs when context is fresh — not after you're done.

**If a doc doesn't exist yet, create it.** A CLI tool without a README is incomplete. An API without endpoint docs is incomplete.

```
Created CLI tool       → create README.md with usage examples NOW
Added new endpoint     → update API.md NOW
Changed schema         → update DATABASE.md NOW
New module             → update ARCHITECTURE.md NOW
```

**doc_targets in your task metadata must list every doc you create or update.** The verifier checks them.

## Update owned_paths

If you touch files not in `owned_paths`, update the metadata. The verifier uses this list for quality checks and test coverage.

## Verification

Before moving to **completing**:

**Functionality:**
- [ ] Every acceptance criterion has corresponding code
- [ ] Tests exist for new behavior (not just old behavior)
- [ ] doc_targets are updated with current changes
- [ ] owned_paths reflects all files you touched

**Code Structure:**
- [ ] No function exceeds ~50 lines
- [ ] No nesting deeper than 3 levels
- [ ] No premature abstractions (class/interface with single use)
- [ ] No magic values — named constants or config used
- [ ] Each function has a single clear concern
- [ ] New code matches existing codebase patterns
- [ ] Error messages include what failed and why
- [ ] 4+ case switch/if-else uses map/registry pattern

**Cleanliness:**
- [ ] No debug artifacts (console.log, debugger, print statements)
- [ ] No commented-out code blocks (3+ lines)
- [ ] No empty catch blocks without explanation
- [ ] No dead parameters or unused imports

**Process:**
- [ ] Progress log has entries for all meaningful steps
- [ ] Standing rules from rules.md are satisfied

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll log progress later" | Compaction can happen any time. Log now. |
| "This refactor is in scope" | Not in acceptance criteria = not in scope. |
| "Tests slow me down" | Verifier checks tests. Write now or get rejected. |
| "Dead code might be useful" | Delete it. Git has history. Verifier flags it. |
| "I'll update docs at the end" | Context fades. Write docs when the change is fresh. |
| "This is a quick improvement" | Quick improvements outside scope become scope creep. Log it, move on. |
| "I'll figure it out as I go" | If you're guessing, stop. Read more code or ask the user. |
| "One big function is easier to follow" | A 100-line function is harder to test, debug, and modify than 5 focused functions. Split by concern. |
| "I'll add the abstraction now, we'll need it" | You don't know what you'll need. Build for today. Generalize at the third use case. |
| "It's just a magic number, everyone knows 86400 is seconds in a day" | Future readers include your forgetful self. Name it `SECONDS_PER_DAY`. |
| "The error message is fine" | `'Failed'` tells the next developer nothing. Say what failed and what to check. |

## Red Flags

- 30+ minutes of work with no progress entries
- Touching 5 files but owned_paths lists 2
- "Just quickly" fixing something outside your task
- Implementing without researching unfamiliar technology
- All decisions lack reasons
- Silently guessing instead of asking when stuck
- Leaving debug artifacts "to clean up later"
