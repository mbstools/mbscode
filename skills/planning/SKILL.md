---
name: planning
description: "Breaks work into tasks with acceptance criteria. Use when starting new work, when the user asks for a feature, or when you need to decompose a request into implementable units."
---

# Planning

## Overview

Turn a request into tasks with specific, verifiable acceptance criteria. Research the codebase, propose concrete solutions, get approval, then decompose into vertical slices.

## When to Use

- New feature request, project, or multi-step work
- Bug that needs investigation before scoping
- User says "plan", "build", "add", or "design"
- Any request that involves more than one file or concern

**When NOT to use:**
- You already have a task with criteria → go to **executing**
- Trivial change the user said "just do it" → create a minimal task and start
- You're debugging → go to **debugging** first, plan after diagnosis
- You're completing work → go to **completing**

## Process

### 1. Understand Before Deciding

Read the codebase first. Don't plan in a vacuum.

```
1. Read existing code in the area you'll change
2. Grep for related patterns, imports, conventions
3. Check if similar functionality already exists
4. Read relevant docs (API specs, database schema, READMEs)
```

If the technology or domain is unfamiliar, **research before asking the user:**

```
✗ Bad: "Should I use Redis or Memcached?"
  (You should research which one fits, then recommend)

✓ Good: "The app already uses Redis for sessions (see src/config/redis.ts).
  I recommend using the same Redis instance for caching, with a separate
  key prefix 'cache:'. This avoids adding a new dependency.
  Alternative: a separate Memcached instance would give better cache-specific
  features but adds operational complexity. I recommend Redis. Agree?"
```

**Research means:**
- Read the existing codebase for prior art
- Check project dependencies for what's already available
- Read official documentation for unfamiliar technology
- Check existing patterns before proposing new ones

### 2. Scan for Gaps

Not all requests have gaps. A clear bug report has none. A vague feature request has many.

Check these against the request — **only ask about gaps that change architecture or scope:**

| Category | Ask if... | Example question |
|----------|-----------|-----------------|
| Data | DB type, schema, or migrations are unclear | "The users table doesn't have a `role` column yet. I'll add a migration with `role VARCHAR(20) DEFAULT 'user'`. Does 'user', 'admin', 'moderator' cover the roles you need?" |
| API surface | Endpoints, input/output, status codes undefined | "I'll add `POST /api/invites` that accepts `{email, role}` and returns `{invite_id, expires_at}`. Should invites expire? I'd suggest 72 hours, configurable via `INVITE_TTL_HOURS`." |
| Auth | Who can do what is unspecified | "Currently any authenticated user can hit all endpoints. For invites, I'd restrict to admin role only. Should moderators also invite, or just admins?" |
| Scope boundary | What's NOT included is ambiguous | "I'll handle invite creation and acceptance. I won't build: email sending (that's a separate task), invite revocation, or bulk invites. Correct?" |
| Dependencies | External services or libraries unresolved | "For email, the project already has `nodemailer` in package.json but no configuration. I'll use that rather than adding SendGrid. OK?" |

**Don't ask what you can decide yourself:**
- Implementation patterns (try/catch, file structure) → follow existing codebase
- Industry standards (bcrypt rounds, UUID format) → use standard values
- Anything the existing codebase already answers → read it

### 3. Ask Questions With Concrete Proposals

Never ask open-ended questions. Always propose a specific answer and ask for confirmation.

```
✗ "What database should we use?"
✗ "How should I handle errors?"
✗ "What's the authentication strategy?"

✓ "The project uses PostgreSQL (see docker-compose.yml:12).
   I'll add a 'notifications' table with columns: id, user_id, type, message,
   read_at, created_at. The type column will be an enum: 'info', 'warning', 'error'.
   This matches the existing 'audit_logs' table pattern. Sound right?"

✓ "For validation errors, the existing API returns 400 with
   {error: string, fields: {[field]: string}}  (see src/middleware/validate.ts:23).
   I'll follow the same pattern. For auth errors, it returns 401 with {error: string}.
   I'll keep that too. OK?"

✓ "The app uses JWT with HS256 (src/auth/token.ts:8). For the new
   service-to-service auth, I recommend RS256 instead — it supports key
   rotation without redeploying. Trade-off: slightly more setup (key pair
   generation). Alternative: keep HS256 with a shared secret, simpler but
   less secure for service-to-service. I recommend RS256. Your call."
```

**Pattern: State what you found → Propose what you'll do → Explain why → Ask to confirm**

### 4. Present Alternatives When It Matters

When a decision has real trade-offs, present options with concrete pros/cons:

```
For rate limiting, I see two viable approaches:

Option A: Express middleware (express-rate-limit)
  + Already a dependency (package.json:34)
  + Simple: 5 lines of config
  - Per-process only — won't work if we scale to multiple instances

Option B: Redis-based (rate-limit-redis)
  + Works across instances
  + Project already uses Redis (src/config/redis.ts)
  - Adds a dependency, slightly more setup

Given the project is single-instance right now, I recommend Option A
with a TODO to migrate to Option B when scaling. Or should I build
for multi-instance from the start?
```

**Don't present alternatives for decisions that don't matter** (which test runner to use when the project already has one, which date library when dayjs is already installed).

### 5. Get Approval When Stuck

If you're uncertain about a decision that affects architecture or scope:

1. **State what you know** — what you've read, what you've found
2. **State what you don't know** — the specific gap
3. **Propose a path** — your recommendation with reasoning
4. **Ask explicitly** — "Should I proceed with this approach?"

```
I've read the auth module (src/auth/) and the existing middleware chain.
I see that authentication is done via JWT but authorization is checked
inline in each route handler (e.g., src/routes/admin.ts:15 checks req.user.role).

I don't know if you want to keep inline checks or centralize authorization.

I recommend a centralized middleware: authorize('admin', 'moderator') that
wraps routes. This matches how authenticate() already works and reduces
duplication. But it means touching every protected route in this task.

Should I centralize, or keep inline checks and only add them to new routes?
```

**Never silently pick an option and hope.** Especially for:
- Database schema decisions
- API contract decisions
- Authentication/authorization model
- Anything that's hard to change later

### 6. Plan Documentation

Every deliverable needs documentation. Decide what docs are needed **before** writing code.

**Check what exists:**
```
Glob for *.md in project root and docs/
→ README.md exists? API.md? ARCHITECTURE.md?
```

**Decide what's needed based on what you're building:**

| Building | Required doc |
|----------|-------------|
| CLI tool | README.md with usage examples for every command |
| API | README.md + API.md with every endpoint |
| Library | README.md with install, usage, API reference |
| New module in existing project | Update existing README/ARCHITECTURE |
| Config/infra change | Update relevant ops/deployment docs |

**If a doc doesn't exist, create it. If it exists, update it.**

Fill `doc_targets` with every doc that needs creating or updating:

```json
{
  "doc_targets": ["README.md"],
  "acceptance": [
    "...(feature criteria)...",
    "README.md documents all CLI commands with usage examples"
  ]
}
```

Documentation criteria go in `acceptance` — the verifier checks them like any other criterion. A feature without documentation is an incomplete feature.

```
✗ Wrong: doc_targets is empty because "no docs exist yet"
  → If no docs exist, CREATE them. That's the point.

✗ Wrong: doc_targets is empty because "it's a small change"
  → If a user will interact with it, it needs documentation.

✓ Right: doc_targets: ["README.md"] — will create with usage examples
✓ Right: doc_targets: ["docs/API.md"] — will update with new endpoint
```

### 7. Decompose (M+ work only)

| Size | What | How |
|------|------|-----|
| XS/S | One file, one concern | Single task, skip decomposition |
| M | One feature, multiple files | One slice, 2-3 tasks |
| L/XL | Cross-cutting, multiple features | Milestones → slices → tasks |

**Vertical slices** — each slice delivers working end-to-end functionality:

```
Slice 1: User can create an account (schema + API + validation)
Slice 2: User can log in (auth + API + token)
Slice 3: User can access protected routes (middleware + tests)
```

Not horizontal layers (all DB first, then all API, then all UI).

If a task would take more than one session → too big. Split it.

### 8. Write Acceptance Criteria

The criteria are what the completion-verifier agent checks against actual code. They must be specific enough that reading source files can confirm them.

**Good** — specific, testable, observable from code:
```json
{
  "acceptance": [
    "POST /auth/login returns 200 with {token: string} on valid credentials",
    "POST /auth/login returns 401 with {error: 'Invalid credentials'} on wrong password",
    "JWT token contains {id, email, role} and expires after 1 hour (configurable via AUTH_TOKEN_TTL)"
  ]
}
```

**Bad** — vague, untestable:
```json
{
  "acceptance": [
    "Login works correctly",
    "Good error handling",
    "Secure implementation"
  ]
}
```

The verifier reads code to check "returns 200 with `{token: string}`." It can't check "works correctly."

**Criterion limit:** A task with more than 7 criteria is too big — split it.

### 9. Create Task

`TaskCreate` → hook creates `.mbscode/tasks/<id>.json` → fill it:

```json
{
  "acceptance": ["...specific criteria..."],
  "doc_targets": ["docs that must reflect changes"],
  "owned_paths": ["files this task creates or modifies"],
  "directives": ["constraints or user preferences"]
}
```

### 10. Verify Your Plan

Before starting implementation, check:

- [ ] Every task has specific, code-verifiable acceptance criteria
- [ ] No task has more than 7 criteria
- [ ] Slices are vertical (end-to-end), not horizontal (layer by layer)
- [ ] doc_targets lists docs that need updating (are you sure none do?)
- [ ] Dependencies between tasks are clear
- [ ] User has confirmed the plan (for M+ sized work)
- [ ] Unfamiliar technology has been researched
- [ ] Architecture decisions have been proposed and approved

## Handling Gaps During Implementation

You will discover gaps while coding.

1. Stop coding.
2. Fits current task? → update acceptance criteria, confirm with user if scope-changing.
3. Changes scope? → present to user with concrete proposal.
4. Separate concern? → note in progress, new task later.

```json
{ "text": "NOTICED: Need password reset flow — out of scope, separate task" }
```

## Verification

Before moving to **executing**:

- [ ] Every task has specific, code-verifiable acceptance criteria
- [ ] No task has more than 7 criteria
- [ ] Slices are vertical (end-to-end), not horizontal (layer by layer)
- [ ] doc_targets lists docs that need updating
- [ ] Unfamiliar technology has been researched (not guessed)
- [ ] Architecture decisions have been proposed with trade-offs and approved by user
- [ ] Questions to user included concrete proposals (not open-ended)
- [ ] User has confirmed the plan (for M+ sized work)

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too small for a task" | No task = no verification. 10 seconds to create. |
| "I don't know acceptance yet" | Start with what you know. Empty = can't complete. |
| "I'll plan as I go" | Planning prevents scope creep. Even rough beats nothing. |
| "The user wants it now, no time to plan" | A 30-second plan prevents a 30-minute rework. |
| "I'll just start coding and see" | Coding without criteria = no way to verify you're done. |
| "This is obvious, no decomposition needed" | Obvious work still needs acceptance criteria. Skip decomposition, not criteria. |
| "I'll ask the user what to do" | Research first, then propose. Open-ended questions waste the user's time. |
| "I don't know this technology" | Read the docs before asking. Come with a recommendation, not a blank slate. |
| "I'll just pick one and move on" | If it affects architecture, propose and confirm. If it doesn't, then yes, just pick. |
| "The user will tell me if it's wrong" | Don't rely on the user to catch your mistakes. Surface trade-offs upfront. |
| "No docs needed, it's small" | If a user interacts with it, it needs documentation. Size doesn't matter. |
| "I'll write docs after the code" | Docs after code are always worse. Plan them now, write alongside code. |
| "doc_targets is empty, no docs to check" | Empty doc_targets means you forgot to plan docs, not that none are needed. |

## Red Flags

- Acceptance criteria you can't explain how to verify → too vague
- Task with more than 7 criteria → too big, split
- All tasks have empty doc_targets → are you sure no docs need updating?
- Planning takes longer than the work → overplanning XS/S work
- Starting implementation without user confirmation on M+ plans
- All criteria start with "should" or "must" without specifics → rewrite with concrete behavior
- Open-ended questions to the user without a concrete proposal
- No codebase research before proposing architecture
- Picking a technology without checking what the project already uses
- Silently making architecture decisions without surfacing trade-offs
