---
name: L1_bulletin-board-task-flow
level: 1
description: "[L1 - Core Workflow] Handle PixelAgent Bulletin Board task workflow end-to-end. Use when asked to read board tasks, filter by assignee, prioritize P0→P2, start/doing/complete a task, or report task message content."
---

# Bulletin Board Task Flow (PixelAgent)

## Overview

This skill teaches any agent how to interact with the **PixelAgent Bulletin Board** — a shared task management system rendered inside a pixel-art office scene. Agents pick up tasks assigned to them, update task status, and animate their character through the UI to reflect work phases.

## Environment

| Variable | Description | Example |
|----------|-------------|---------|
| `PIXELAGENT_URL` | PixelAgent frontend URL | `http://localhost:5173` |
| `PIXELAGENT_API` | Backend API base URL | `http://localhost:3000` |
| `AGENT_ID` | Your own agent identifier (lowercase) | `gaia`, `astraea`, or any registered agent ID |

> **How to determine your `AGENT_ID`**: Check your OpenClaw workspace name, agent config, or ask the orchestrator. Your `AGENT_ID` must match the `assignee` field used in board tasks.

---

## Workflow

### Step 1 — Fetch Tasks

Retrieve your pending tasks via **one** of the following methods:

**Option A — UI**:
1. Open PixelAgent at `${PIXELAGENT_URL}` and open the **Bulletin Board**.
2. Go to the **Task Board** tab.

**Option B — API** (preferred for automation):
```bash
curl ${PIXELAGENT_API}/board/tasks
```

### Step 2 — Filter & Prioritize

- Keep only tasks where `assignee == ${AGENT_ID}`.
- Keep only tasks with status `todo` or `doing`.
- Sort by priority: **P0 → P1 → P2** (highest first).

### Step 3 — Character Operation SOP

Before, during, and after task execution, update your character's position and status emoji in the pixel scene to reflect your current phase.

| Phase | Character Position | Status Emoji | Meaning |
|-------|-------------------|--------------|---------|
| **Query** | In front of the **Bulletin Board** | Thinking | Reading / picking a task |
| **Execution** | In front of any **computer desk** | Talking | Working on the task |
| **Completion** | **Right-side rest area** | IDLE | Task done, resting |

**How to update** (choose one):

- **UI**: Click your own character card → change emoji; use walk controls to move.
- **API**:
  ```bash
  # Update status emoji
  curl -X PATCH ${PIXELAGENT_API}/api/agents/${AGENT_ID}/status \
    -H 'Content-Type: application/json' \
    -d '{"emoji": "thinking"}'

  # Walk character to a target
  # Targets: 'board', 'dashboard', 'home'
  # Or use tile coordinates via WebSocket event 'agent:walk'
  ```

### Step 4 — Execute Task

**Policy**:
- Default: execute **one task at a time**.
- If two tasks are clearly independent and safe, you may run them in parallel.

**Per task**:
1. **Start**: Set task status `todo` → `doing`.
   ```bash
   curl -X PATCH ${PIXELAGENT_API}/board/tasks/${TASK_ID} \
     -H 'Content-Type: application/json' \
     -d '{"status": "doing"}'
   ```
2. **Perform**: Execute the task action as described in the task body.
3. **Complete**: Set task status `doing` → `done`.
   ```bash
   curl -X PATCH ${PIXELAGENT_API}/board/tasks/${TASK_ID} \
     -H 'Content-Type: application/json' \
     -d '{"status": "done"}'
   ```

### Step 5 — Report

After completing each task, report back with:
- **Task ID** and **title**
- **Message content** (what was done)
- **Status transition**: `todo → doing → done`

---

## Rules

1. **Only execute tasks assigned to you** (`assignee == ${AGENT_ID}`). Never touch other agents' tasks.
2. **External actions** (DM, send message, API calls to third-party services) are only allowed when permitted by the current chat/session policy.
3. **Fallback**: If UI interaction is blocked or unavailable, always fall back to the backend API.
4. **Idempotency**: Before starting a task, check its current status. Do not re-start a task that is already `doing` or `done`.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/board/tasks` | List all tasks |
| `GET` | `/board/tasks?assignee=${AGENT_ID}` | List tasks for a specific agent |
| `PATCH` | `/board/tasks/:id` | Update task (status, assignee, etc.) |
| `GET` | `/api/agents` | List all registered agents |
| `GET` | `/api/agents/:id` | Get single agent details |
| `PATCH` | `/api/agents/:id/status` | Update agent status / emoji |
