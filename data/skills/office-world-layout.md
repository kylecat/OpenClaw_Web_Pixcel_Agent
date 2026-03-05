---
name: office-world-layout
description: Understand the PixelAgent office world layout, walkable corridors, blocked furniture tiles, and key navigation targets. Use when planning character movement, pathfinding, or deciding where to walk an agent.
---

# Office World Layout (PixelAgent)

## Overview

This skill teaches any agent the **spatial layout** of the PixelAgent pixel-art office.
The full layout specification (ASCII map, furniture table, blocked tiles) is maintained as a versioned document.
Always read the latest version to get up-to-date coordinates.

## Layout Source

> **Read the latest layout file before navigating.**
>
> Path: `DevDocuments/LAYOUT_v1.md`
>
> Contains: ASCII grid map, decoration table, zone breakdown, walkable corridors.

---

## Quick Reference

### Grid Basics

- **22 cols x 12 rows** (col 0-21, row 0-11), tile = 64x64 px
- Coordinate: `(col, row)` — col = rightward, row = downward

### Three Zones

| Zone | Columns | Purpose |
|------|---------|---------|
| Left Zone | 0-13 | Work area (bulletin board, dashboard, PC desks, shelves) |
| Divider | 14 | Pot wall (rows 1-8), gap at rows 0 and 9-11 |
| Right Zone | 15-21 | Lounge (vending machine, fridge, sofas, tea table) |

### Key Navigation Targets

| Destination | Walk To (col, row) | When to go |
|-------------|-------------------|------------|
| Bulletin Board | (3, 2) | Read / pick up tasks |
| Dashboard | (10, 2) | View session summary |
| Exit Door | (17, 2) | Leave the office |
| Portal | (20, 2) | Teleport / transfer |
| PC Desk (left) | (7, 3) | Work at left desk |
| PC Desk (right) | (9, 3) | Work at right desk |
| Shelf 1 (TASK) | (2, 3) | Browse TASK shelf |
| Shelf 2 (SKILL) | (8, 7) | Browse SKILL shelf |
| Rest Area | (17, 9) | Rest after completing a task |
| Gaia Home | (6, 6) | Gaia idle position |
| Astraea Home | (18, 5) | Astraea idle position |

### Main Walkable Corridors

1. **Top corridor** — row 2, cols 0-21 (connects wall-mounted items)
2. **Left mid corridor** — rows 6-7, cols 0-13 (between desks and shelves)
3. **Right mid corridor** — rows 6-7, cols 15-21 (between appliances and lounge)
4. **Bottom corridor** — rows 9-11, cols 0-15 (south side)
5. **Cross-zone passage** — col 14, rows 9-11 (gap in pot divider)

### Navigation Tips

- **Left to Right zone**: walk to row 9+ and cross col 14, or go via row 0.
- **Pot divider (col 14)** blocks rows 1-8. Plan routes around it.
- **PC desks** block 2 rows (4-5). Approach from row 3 (above) or row 6 (below).

---

## API — Walk Agent

```bash
# Walk to a named target
curl -X POST ${PIXELAGENT_API}/api/agents/${AGENT_ID}/walk \
  -H 'Content-Type: application/json' \
  -d '{"target": "board"}'
# Supported targets: 'board', 'dashboard', 'home'

# Walk to arbitrary tile via WebSocket
# Event: 'agent:walk' with payload { agentId, col, row }
```

---

## API — Shelf Interaction

Agents can browse shelf contents directly via API **without clicking the UI**.
This is the recommended approach — more reliable than UI click.

### Shelf Mapping

| Shelf | API rootKey | Contents |
|-------|------------|----------|
| Shelf 1 (Research Log) | `tasks` | Task markdown files |
| Shelf 2 (SKILL) | `skills` | Skill definition files |
| Shelf 3 (Data / DevDocs) | `devdocs` | DevDocuments & data |

### Endpoints

```bash
# List files in a shelf root
curl ${PIXELAGENT_API}/api/shelf/{rootKey}
# Example: curl ${PIXELAGENT_API}/api/shelf/tasks

# List files in a sub-directory
curl "${PIXELAGENT_API}/api/shelf/{rootKey}?sub=subfolder"

# Read a specific file
curl "${PIXELAGENT_API}/api/shelf/{rootKey}/file?path=TASK-002.md"
```

### When to Use

- **API (recommended)**: When you need to read shelf contents programmatically — faster and more reliable.
- **UI click**: When you want the character to visually walk to the shelf and open the modal for user observation. Shelves have an expanded click area (half-tile padding) for easier targeting.
