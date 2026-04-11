---
name: planning
description: Use when breaking down user requests into structured work. Covers spec development, milestone/slice/task decomposition, and task metadata creation. Activate when starting new work or when the user requests a plan.
---

# Planning

## Overview

Every piece of work — from a multi-month project to a one-line bugfix — follows this flow:

```
Request → (Spec if ambiguous) → Milestones → Slices → Tasks
```

Small work can skip milestones/slices and go straight to a task.

## When to Plan

- **New feature request** → Full plan: spec → milestones → slices → tasks
- **Bug fix** → Single task with clear acceptance criteria
- **Refactor** → Task(s) with scope boundaries
- **User says "just do it"** → Still create a task. It takes 10 seconds.

## Spec Development

Before creating any task, make sure you understand what you're building. Scan the request for gaps in these categories:

### Gap Categories

| Category | What to check | Example gap |
|----------|--------------|-------------|
| **Data** | Where is data stored? What's the schema? Migrations? | "Login system" — but no DB chosen |
| **API surface** | What endpoints/commands? Input/output format? Status codes? | "REST API" — but no routes defined |
| **Auth & security** | Who can do what? How are users identified? | "Admin panel" — but no auth strategy |
| **Error handling** | What happens on failure? User-facing messages? | "Payment flow" — but no failure cases |
| **Dependencies** | External services, libraries, infrastructure? | "Send emails" — but no provider chosen |
| **Integration** | How does it connect to existing code? Breaking changes? | "Add feature" — but where does it live? |
| **Scope boundary** | What's explicitly NOT included? | "User management" — does it include roles? |
| **Performance & scale** | Expected load? Caching? Rate limits? | "Chat system" — 10 users or 10K concurrent? |
| **Deployment** | Docker? Serverless? CI/CD? Environment config? | "New service" — but no deploy target |
| **UI/UX constraints** | Responsive? Accessible? Mobile? Design system? | "Dashboard" — but no layout spec |

### How to Ask

Use the **native ask_user tool** for every question. One question per call.

**Always recommend your preferred option first.** Research modern best practices before asking — use web search if the domain is unfamiliar. Your recommendation should reflect the simplest, most modern approach for the project's context.

Good example:
```
ask_user(
  question: "What auth strategy should I use for the API?",
  choices: ["JWT with RS256 (Recommended — stateless, standard)", "Session cookies", "OAuth2 with external provider"]
)
```

Bad examples:
- ❌ Asking without a recommendation: "What auth do you want?"
- ❌ Dumping multiple questions: "What DB, what auth, what framework?"
- ❌ Asking what you can decide yourself: "Should I use try/catch for errors?"

### Research Before Asking

If you're unsure about the best approach:

1. **Check the existing project** — what patterns are already in use? Match them.
2. **Web search** — "best practices for X in 2026" — prefer modern, minimal solutions.
3. **Then recommend** — "Based on your project using Express + TypeScript, I recommend Zod for validation. It has native TS support and is the standard for Express apps."

Don't ask questions you can answer by reading the codebase or searching the web.

### When to Stop Asking

There is no fixed checklist. Every request has different critical gaps. Ask yourself:

> "For THIS specific request, what can't I decide on my own?"

Things you CAN decide yourself (don't ask):
- Implementation patterns (try/catch, error formats, file structure)
- Industry standards (bcrypt for passwords, UUID for IDs)
- Anything the existing codebase already answers

Things you MUST ask about:
- Choices that change the architecture (DB type, auth strategy, monolith vs microservice)
- Choices that affect the user's workflow (CLI vs GUI, sync vs async)
- Scope boundaries the user hasn't clarified ("does user management include roles?")

Stop asking when: you could write specific acceptance criteria for every task. If you can't write "returns 401 on expired token" level criteria, you still have gaps.

If the user says "just do it" or "you decide" — make reasonable choices, document them as decisions in the task metadata, and proceed. Don't ask again.

### Examples

**User: "Login sistemi yap"**
```
Gap scan:
  ❓ Auth strategy → MUST ask (JWT vs session vs OAuth — changes architecture)
  ❓ Frontend → MUST ask (API only vs UI — changes scope entirely)
  ✅ Database → project already uses PostgreSQL → don't ask, use it
  ✅ Password hashing → bcrypt, industry standard → don't ask
  ✅ Error format → match existing API patterns → don't ask
```

**User: "Add dark mode to the app"**
```
Gap scan:
  ❓ Scope → MUST ask (just color scheme, or full theme system with user preference?)
  ❓ Persistence → MUST ask (localStorage vs user profile setting?)
  ✅ CSS approach → project uses Tailwind → use Tailwind dark: classes → don't ask
  ✅ Default → system preference → industry standard → don't ask
```

**User: "Fix the login bug — users get 500 error"**
```
Gap scan:
  ✅ Nothing to ask — investigate the bug, fix it, write a test
  This is a bug fix, not a feature. Read logs, reproduce, fix.
```

## Spec Gaps During Implementation

You will discover gaps while coding. This is normal. Handle them:

1. **Stop coding** — don't hack around a spec gap
2. **If it fits the current task** → update acceptance criteria and directives in the metadata
3. **If it changes scope** → ask the user with ask_user. Don't silently expand.
4. **If it's a separate concern** → note it in progress, create a new task later

Example: You're implementing login and realize you need a password reset flow.
- Password reset is NOT in the current task's acceptance criteria
- Log in progress: "Discovered need for password reset — out of scope for this task"
- Create a new task for it later

## Decomposition

### Milestones

High-level goals. Each delivers independently useful value.

```
M1: Core Authentication
M2: User Management
M3: API Documentation
```

### Slices

Vertical slices within a milestone. Each is deployable.

```
M1/S1: JWT Token Infrastructure
M1/S2: Login/Logout Endpoints
M1/S3: Protected Route Middleware
```

### Tasks

Atomic units of work. Each task:
- Can be completed in one session
- Has clear acceptance criteria
- Has defined doc targets and owned paths

## Creating a Task

1. **Create the task** using native TaskCreate with a clear subject and description.

2. **Fill the metadata** — the TaskCreated hook creates `.mbscode/tasks/<task_id>.json`. Edit it:

```json
{
  "task_id": "task-001",
  "subject": "Add JWT validation middleware",
  "acceptance": [
    "Middleware rejects expired tokens with 401",
    "Middleware extracts user ID from valid tokens",
    "Protected routes return 401 without token"
  ],
  "doc_targets": ["docs/API.md", "docs/ARCHITECTURE.md"],
  "owned_paths": [
    "src/middleware/auth.ts",
    "tests/middleware/auth.test.ts"
  ],
  "directives": ["Use RS256 for JWT signing"],
  "progress": [],
  "decisions": []
}
```

### Field Guide

| Field | Required? | What it means |
|-------|-----------|---------------|
| `acceptance` | **Yes** | Agent hook checks these at completion |
| `doc_targets` | Recommended | Docs that must reflect changes |
| `owned_paths` | Recommended | Files this task touches (agent checks quality) |
| `directives` | Optional | Constraints or preferences |
| `progress` | Fill as you go | What was done and when |
| `decisions` | Fill as you go | Choices made and why |

### Acceptance Criteria Rules

- **Specific and testable** — "returns 401" not "handles errors"
- **Observable from code** — the agent reads files, not memory
- **Complete** — if it matters, list it

## For Small Work

Even a one-line fix gets a task:

1. Native TaskCreate: "Fix typo in auth error message"
2. Fill acceptance: `["Error message says 'Invalid token' not 'Invlaid token'"]`
3. Work, complete, agent verifies.

Why? Because the completion hook checks docs and rules. Without a task, there's no verification.

## Rationalizations vs Reality

| Rationalization | Reality |
|---|---|
| "It's too small for a task" | Task creation takes 10 seconds. Skipping it means no verification. |
| "I don't know the acceptance criteria yet" | Start with what you know. Update as you learn. |
| "doc_targets is empty — no docs needed" | Agent still checks standing rules. If rules say update docs, empty doc_targets won't save you. |
| "I'll plan as I go" | Planning prevents scope creep. Even a rough plan is better than none. |

## Verification

After planning:
- [ ] Every task has acceptance criteria
- [ ] doc_targets list all affected docs
- [ ] owned_paths list all files to be changed
- [ ] No task is too large for one session
