---
name: L0_farm-world-layout
level: 0
description: "[L0 - Essential] Understand the PixelAgent outdoor farm world layout, isometric grid, walkable paths, blocked areas, clickable buildings, and key navigation targets."
---

# Farm World Layout (PixelAgent)

## Overview

This skill teaches any agent the **spatial layout** of the PixelAgent outdoor farm scene.
The farm uses an **isometric (2:1 diamond)** projection — coordinates are `(col, row)` mapped to screen via iso math, unlike the orthogonal office scene.

---

## Grid Basics

- **64 cols × 48 rows** (col 0-63, row 0-47)
- Isometric tile: `ISO_TILE_W = 64 px`, `ISO_TILE_H = 32 px` (2:1 diamond)
- Coordinate: `(col, row)` — col increases right-down, row increases left-down
- Canvas is displayed at **50% scale** (logical coords ×2 for hit-testing)

## Tile Types

| Tile Kind | Description | Walkable? |
|-----------|-------------|-----------|
| `GRASS`   | Default ground | Yes |
| `PATH`    | Stone walkway connecting buildings | Yes |
| `DIRT`    | Crop area soil | Yes |
| `WATER`   | River (bottom-left diagonal) | **No** |

---

## Zones & Layout

```
          N (top)
         /    \
        /      \
  NW   /  FARM  \   NE
      /   SCENE   \
     /              \
    W ──────────────── E
     \              /
      \   River    /
       \  (SW)    /
        \        /
         \      /
          S (bottom)
```

### Major Areas

| Area | Col Range | Row Range | Contents |
|------|-----------|-----------|----------|
| Tree Border (top) | 0-63 | 0, 4 | Dense tree line (boundary) |
| Tree Border (left) | 0 | 8-39 | Single tree column |
| Tree Border (right) | 58-63 | 8-39 | Dense tree columns |
| Tree Border (bottom) | 12-63 | 38, 42 | Bottom boundary trees |
| Greenhouses | 14-39 | 12-19 | 3 side-by-side greenhouses |
| Weather Station | 8-11 | 18-21 | Weather monitoring |
| Cabin | 8-13 | 26-31 | Indoor teleport point |
| Wind Turbine | 50-53 | 10-13 | Power generation |
| Crop Plots | 18-44 | 28-36 | 4 long crop plots |
| Open Grass | 14-57 | 22-27 | Main walking area |
| River | 0-31 | 44-47 | Diagonal water (blocked) |

---

## Key Navigation Targets

| Destination | Walk To (col, row) | Purpose |
|-------------|-------------------|---------|
| Greenhouse 1 | (16, 22) | Manage crops in GH1 |
| Greenhouse 2 | (26, 22) | Manage crops in GH2 |
| Greenhouse 3 | (36, 22) | Manage crops in GH3 |
| Cabin | (14, 33) | Teleport back to office |
| Weather Station | (12, 23) | Check weather data |
| Gaia Home (outdoor) | (28, 24) | Gaia idle position |
| Astraea Home (outdoor) | (40, 24) | Astraea idle position |

---

## Clickable Objects & Hit Areas

Hit-testing priority (highest to lowest):

### 1. Characters
- Bounding box: 48 × 64 px around character screen position
- Returns: `{ kind: 'character', id }` — e.g., `'gaia'`, `'astraea'`

### 2. Interactive Buildings

| Building | Grid Position | Size (tiles) | Click Returns |
|----------|--------------|-------------|---------------|
| Greenhouse 1 | (14, 12) | 6 × 8 | `{ kind: 'greenhouse', index: 0 }` |
| Greenhouse 2 | (24, 12) | 6 × 8 | `{ kind: 'greenhouse', index: 1 }` |
| Greenhouse 3 | (34, 12) | 6 × 8 | `{ kind: 'greenhouse', index: 2 }` |
| Weather Station | (8, 18) | 4 × 4 | `{ kind: 'weatherStation' }` |
| Cabin | (8, 26) | 6 × 6 | `{ kind: 'cabin' }` |

- Hit area: isometric diamond covering the full tile footprint
- Formula: `|dx/halfW| + |dy/halfH| <= 1` where half-sizes = `tileSize × HALF_W/H`

### 3. Other Decorations

| Decoration | Grid Position(s) | Size (tiles) | Notes |
|------------|-----------------|-------------|-------|
| Wind Turbine | (50, 10) | 4 × 4 | Visual only |
| Crop (long growing) | (18, 28), (42, 28) | 3 × 9 | Click returns `{ kind: 'decoration', decoKind }` |
| Crop (long covered) | (26, 28) | 3 × 9 | Same |
| Crop (long harvest) | (34, 28) | 3 × 9 | Same |
| Trees | border areas | 1 × 2 | Walkable, visual boundary |
| Bushes | scattered | 1 × 1 | Walkable, visual |

### 4. Ground Tile
- Clicking empty ground returns `null` (deselects current selection)
- Grid tile calculated via `screenToIso()` reverse projection

---

## Walkable Paths

The path network connects all major buildings (2 tiles wide):

1. **Main horizontal path** — rows 20-21, cols 14-48 (below greenhouses, connects all areas)
2. **Vertical path (west)** — cols 14-15, rows 20-34 (connects greenhouses to cabin)
3. **Cabin connector** — rows 32-33, cols 14-16 (short spur to cabin entrance)

### Navigation Tips

- **Office → Farm**: Click the Exit Door in the office, or use cabin in reverse
- **Farm → Office**: Walk to cabin at `(14, 33)` and click it to teleport back
- **Between greenhouses**: Use the main horizontal path (row 20-21)
- **To weather station**: Walk south on vertical path, weather station is at `(12, 23)`
- **Avoid river**: Bottom-left area (rows 44-47, cols 0-31) is water — impassable

---

## Blocked Tiles Summary

The following tile ranges are **not walkable**:

| Blocker | Tile Area |
|---------|-----------|
| Greenhouse 1 | cols 14-19, rows 12-19 |
| Greenhouse 2 | cols 24-29, rows 12-19 |
| Greenhouse 3 | cols 34-39, rows 12-19 |
| Cabin | cols 8-13, rows 26-31 |
| Weather Station | cols 8-11, rows 18-21 |
| Wind Turbine | cols 50-53, rows 10-13 |
| Crop plots | (3×9 each) at cols 18/26/34/42, row 28 |
| River (water) | rows 44-47, diagonal from left |

> **Note**: Trees and bushes are **visual only** — they do NOT block movement.

---

## API — Walk Agent (Outdoor)

```bash
# Walk to a named target
curl -X POST ${PIXELAGENT_API}/api/agents/${AGENT_ID}/walk \
  -H 'Content-Type: application/json' \
  -d '{"target": "cabin"}'
# Supported targets: 'cabin', 'weather', 'greenhouse1', 'greenhouse2', 'greenhouse3'

# Walk to arbitrary tile via WebSocket
# Event: 'agent:walk' with payload { agentId, col, row }
```

---

## Isometric Coordinate Reference

Screen position from grid `(col, row)`:
```
screenX = (col - row) × 32 + ISO_ORIGIN_X
screenY = (col + row) × 16 + ISO_ORIGIN_Y
```

Grid position from screen `(sx, sy)`:
```
col = floor(((sx - originX) / 32 + (sy - originY) / 16) / 2)
row = floor(((sy - originY) / 16 - (sx - originX) / 32) / 2)
```

---

## Source Files

| File | Purpose |
|------|---------|
| `frontend/src/scene/outdoor/outdoorWorldState.ts` | Grid, decorations, constants |
| `frontend/src/scene/outdoor/outdoorConfig.ts` | SceneConfig for outdoor |
| `frontend/src/scene/outdoor/outdoorRenderer.ts` | Isometric rendering pipeline |
| `frontend/src/scene/outdoor/outdoorHitTest.ts` | Click detection logic |
| `frontend/src/scene/outdoor/isoMath.ts` | Iso ↔ screen coordinate math |
| `frontend/src/scene/outdoor/outdoorSprites.ts` | Asset loading |
| `frontend/public/assets/outdoor/` | All farm PNG sprites |
