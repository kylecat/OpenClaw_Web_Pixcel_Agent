# Task Flow Record — Publish → Accept → Complete

Date: 2026-03-05 (Asia/Taipei)
Scope: PixelAgent Bulletin Board workflow validation (Gaia ↔ Astraea)

## Goal
Validate end-to-end flow:
1) Gaia publishes a task
2) Astraea accepts/picks up task
3) Astraea completes task and reports

---

## A. Publish Stage (Gaia)

### Action
Gaia created a task via backend API:
- Endpoint: `POST /board/tasks`
- Payload summary:
  - title: `DM Kyle (from GAIA)`
  - assignee: `astraea`
  - priority: `P1`
  - content: `請 DM Kyle：這是 GAIA 發布的任務。`

### Result
- Created task id: `TASK-004`
- Status: `todo`
- Board view successfully showed new task.

### Persisted data
- `data/tasks/TASK-004.md`

---

## B. Accept Stage (Astraea)

### Expected
Astraea changes task status:
- `todo -> doing`

### Verification points
- Board UI shows status change in Task Board
- API check (`GET /board/tasks`) confirms `TASK-004` status
- Optional: character state/position reflects active work phase

---

## C. Complete Stage (Astraea)

### Expected
Astraea finishes task and updates:
- `doing -> done`
- Sends DM to Kyle: `這是 GAIA 發布的任務。`

### Verification points
- Board/UI/API show `TASK-004` as `done`
- Kyle confirms DM receipt
- Timeline/log keeps task transition history

---

## Token Observation Points (for measurement)

Use `openclaw status` sessions table and record at each stage:
1. Before publish
2. After publish
3. After Astraea starts (`doing`)
4. After Astraea done (`done`)

Recommended tracked sessions:
- `agent:main:main`
- `agent:astraea:main`

---

## Current Issue Observed (Important)

### Symptom
Kyle reported Gaia could not read incoming messages when sent from Telegram DM, while WebUI messages were received normally.

### Current workaround
- Use WebUI to continue coordination while diagnosing channel ingress path.

### Suspected area
- Telegram DM inbound routing/session binding discrepancy for Gaia account.

### Suggested diagnostics
1. Run `openclaw status --deep` and verify Telegram account mapping and DM route state.
2. Check gateway logs around missing DM timestamp.
3. Compare message source metadata between working WebUI events and missing Telegram DM events.
4. Send controlled test DMs (short payload) and log message IDs end-to-end.

---

## Completion Criteria for this flow test
- [ ] TASK-004 reaches `done`
- [ ] Kyle receives Astraea DM content
- [ ] Token checkpoints are captured in 4 stages
- [ ] Telegram DM ingress issue is either fixed or documented with stable workaround
