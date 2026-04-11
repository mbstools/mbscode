# mbscode

Task discipline and semantic verification for Claude Code.

## What It Does

mbscode enforces a simple cycle: **create task → work → verify → complete**.

- Tasks are created with native Claude Code tools (TaskCreate)
- A **completion-verifier agent** checks your work by reading actual files on disk
- A **hook** blocks task completion unless the agent has verified
- Standing rules survive compaction and reach every subagent
- Task metadata (acceptance criteria, doc targets) guides verification

The key: when the main AI wants to complete a task, it must first invoke the **completion-verifier agent** (Read/Grep/Glob access). If the agent confirms everything passes, the task metadata gets a `verified: true` flag. Only then does the TaskCompleted hook allow completion.

## Install

```bash
# Step 1: Add the marketplace
/plugin marketplace add mbstools/mbscode

# Step 2: Install the plugin
/plugin install mbscode@mbstools

# Step 3: Reload plugins
/reload-plugins
```

## How It Works

```
Create Task ──── native TaskCreate
│                task-init hook creates .mbscode/tasks/<id>.json
│                fill in: acceptance, doc_targets, owned_paths
│
Work ─────────── implement, test, document
│  ├─ Subagent → subagent-inject hook: rules + task context injected
│  ├─ Compact ── restore hook: state survives
│  └─ Debug ──── debugging skill: reproduce → isolate → diagnose → fix
│
Verify ───────── invoke completion-verifier agent
│                Agent reads real files and checks:
│                ✓ acceptance criteria (reads code)
│                ✓ docs updated (reads doc files)
│                ✓ tests exist (reads test files)
│                ✓ code quality
│                ✓ standing rules satisfied
│                Fail → fix findings → re-invoke agent
│                Pass → set "verified": true in task metadata
│
Complete ─────── mark task complete natively
                 TaskCompleted hook checks verified flag
                 Not verified → blocks, tells you to call the agent
                 Verified → task done
```

## File Structure

```
.mbscode/                       ← created in your project at runtime
├── rules.md                    — standing user rules (Markdown)
├── context.json                — auto-discovered project context
└── tasks/
    └── <task-id>.json          — metadata per task
```

## Skills

| Skill | Purpose |
|-------|---------|
| `using-mbscode` | Master guide — lifecycle, file formats, hooks, skill discovery |
| `planning` | Spec → milestones → slices → tasks with acceptance criteria |
| `executing` | Disciplined implementation with scope control and progress tracking |
| `debugging` | Systematic debugging: reproduce → isolate → diagnose → fix → verify |
| `completing` | Task completion: self-check → verify → close |
| `recovery` | Cancel, repair, override, compaction recovery |

## Hooks

| Hook | Event | Blocks? | Purpose |
|------|-------|---------|---------|
| `session-init` | SessionStart | No | Creates `.mbscode/`, discovers project, injects rules |
| `task-init` | TaskCreated | No | Creates metadata skeleton |
| `task-complete-guard` | TaskCompleted | **Yes** | Blocks unless `verified: true` + acceptance non-empty |
| `subagent-inject` | SubagentStart | No | Injects rules + task context to subagents |
| `compact-restore` | PostCompact | No | Restores state after compaction |

## Agents

| Agent | Purpose |
|-------|---------|
| `completion-verifier` | Verifies task completion by reading real files — acceptance criteria, docs, tests, code quality, standing rules |

The completion-verifier is a standalone subagent you invoke before completing a task. The TaskCompleted hook blocks completion unless the agent has verified.

## Repository Layout

```
.claude-plugin/   plugin manifest
agents/           completion-verifier subagent
hooks/            hook scripts, shared lib, test suite
skills/           6 methodology skills
```

## Design Principles

- **~200 lines** of custom code — leverage native Claude Code tools, don't replace them
- **Zero external dependencies** — Node.js built-ins only
- **Fail-open** — hook errors don't block work (guard hook excepted)
- **Skills teach, hooks enforce, agent verifies** — three layers, each with a clear role
- **Anti-rationalization** — every skill counters AI excuses for skipping steps

## Testing

```bash
node hooks/test.cjs
```

Runs 35 tests across all hooks: correct output, graceful degradation, fail-open behavior, path traversal prevention.
