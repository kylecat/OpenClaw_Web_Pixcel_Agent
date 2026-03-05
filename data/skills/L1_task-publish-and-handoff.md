---
name: L1_task-publish-and-handoff
level: 1
description: "[L1 - Core Workflow] Publish a task on PixelAgent Bulletin Board, hand it off to another agent, and verify task lifecycle (todo -> doing -> done) with token checkpoints."
---

# Task Publish & Handoff Flow (PixelAgent)

## Overview

Use this skill when you need to:
1. Publish a task to another agent (e.g., Astraea)
2. Confirm board lifecycle transitions
3. Track token usage during the workflow

---

## Prerequisites

- `PIXELAGENT_API=http://localhost:3000`
- Assignee ID is known (`gaia` / `astraea`)
- Task content is clear and executable

---

## Standard Flow

### Step 1 — Publish task

```bash
curl -X POST ${PIXELAGENT_API}/board/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "<task title>",
    "assignee": "astraea",
    "priority": "P1",
    "content": "<task instruction>"
  }'
```

Expected result: JSON contains `id` (e.g., `TASK-00X`) and `status: "todo"`.

### Step 2 — Verify task appears

```bash
curl ${PIXELAGENT_API}/board/tasks
```

Check:
- task ID exists
- assignee is correct
- status is `todo`

### Step 3 — Handoff / notify assignee

Notify assignee in chat (or agreed channel):
- Task ID
- expected output
- acceptance criteria

### Step 4 — Track status transitions

Expected sequence:
- `todo -> doing -> done`

Quick check:

```bash
curl ${PIXELAGENT_API}/board/tasks | jq -r '.[] | select(.id=="TASK-00X") | "\(.id) | \(.status) | \(.assignee)"'
```

### Step 5 — Confirm completion output

Completion is valid when:
- Board status = `done`
- Requested output delivered (e.g., DM sent, report posted, screenshot attached)

---

## Token Observation Checklist

Record `openclaw status` at 4 checkpoints:
1. Before publish
2. After publish
3. After assignee starts (`doing`)
4. After assignee finishes (`done`)

Recommended sessions to track:
- `agent:main:main`
- `agent:astraea:main`

---

## Pitfalls

1. Wrong `assignee` string -> task never picked
2. Missing acceptance criteria -> assignee interpretation drift
3. Only checking chat, not board status -> false completion

---

## Minimal Task Template

```json
{
  "title": "<verb + target>",
  "assignee": "astraea",
  "priority": "P1",
  "content": "請 <agent> 完成 <action>，並回報 <what-to-verify>."
}
```
