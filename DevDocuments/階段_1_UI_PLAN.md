# UI Plan — OpenClaw Pixel Agent

## 1) Information Architecture

### A. Pixel Scene (center stage)
- Gaia / Astraea avatars
- Overhead emoji/status badge
- Walking targets:
  - Bulletin board
  - Dashboard panel

### B. Bulletin Board (left)
- Tabs:
  - **System Alerts** (errors, rate limits, write failures)
  - **Task Board** (new/assigned/in-progress/done)
- Actions:
  - Create task
  - Assign to agent
  - Claim task

### C. Dashboard (right)
- Gateway health/status
- Agent model + context token usage
- Daily token heatmap (GitHub-like grid)
- Host health (CPU/RAM/disk/net)
- LAN IoT online list

### D. Agent Detail Drawer (click avatar)
- Current model/session
- Skill set summary
- Tool availability summary
- Cron bindings and last run result

---

## 2) Status Emoji Mapping

- 🤔 Thinking / planning
- 💬 Conversation active
- 😶 Idle
- 📶⚠️ Network unstable / provider issue
- ❌ Tool/action failed
- 💥 Crash/stuck/timeout
- ✅ Task completed

---

## 3) Event-to-Animation Rules

- New alert -> nearest agent walks to bulletin board
- New assigned task -> assignee agent shows 🤔 then walks to board
- Dashboard refresh timer / major state change -> one agent walks to dashboard
- Task done -> ✅ 3 seconds then return to idle path

---

## 4) Data Feeds (suggested)

### OpenClaw
- `openclaw status` parsed feed
- `openclaw cron list` + `openclaw cron runs --id ...`
- session token stats from status output

### Host
- CPU/RAM/disk/net from local metrics collector

### IoT
- Existing LAN/MQTT/API source (adapter layer)

---

## 5) MVP Scope (recommended)

### In-scope
- Read-only dashboard
- Board view + local task JSON store
- Avatar state/emoji + simple movement

### Out-of-scope (phase 2)
- Direct config writes
- Cron editing from UI
- Skill/tool mutation from UI

---

## 6) Safety & UX Requirements

- Long error content must be collapsible.
- Action buttons in alert/task cards must be sticky and always visible.
- Every config-related panel must show docs links.
- High-risk actions must have explicit confirm modal.

---

## 7) Backlog (P0/P1/P2)

### P0
- Pixel scene layout
- Emoji state engine
- Bulletin board alerts/tasks
- Read-only dashboard basics

### P1
- Agent detail drawer
- Daily token heatmap
- IoT status panel

### P2
- Controlled write actions (with diff/confirm/rollback)
- Policy-driven role permissions

