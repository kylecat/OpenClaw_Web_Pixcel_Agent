import type { WorldState, GridTile, Decoration, DecorationKind } from './types'
import { tileCenter } from './characters'
import { computeBlockedTiles } from './collision'

// Draw / collision tile sizes for high-res decorations: [tilesWide, tilesHigh].
// Shared between renderer.ts (drawing) and collision.ts (pathfinding blocked set).
export const DECO_TILE_SIZE: Partial<Record<DecorationKind, [number, number]>> = {
  fridge:         [1,   2  ],
  squareTable:    [2,   2  ],
  clock:          [1,   1  ],
  shelf1:         [4,   2  ],
  shelf2:         [4,   2  ],
  pcDesk:         [2,   1.5],
  sofa1:          [1,   2  ],
  sofa2:          [1,   2  ],
  sofa3:          [2,   2  ],
  pot1:           [1,   2  ],
  pot2:           [1,   2  ],
  vendingMachine: [2,   2.5],
  waterDispenser: [1,   2  ],
  exitDoor:       [2,   2  ],
  portal:         [2,   2  ],
  shelf3:         [4,   2  ],
}

// 22 × 64 px = 1408 px wide
// 12 × 64 px =  768 px tall
export const COLS = 22
export const ROWS = 12

// Target tile coords
// Layout: 1格 | Board (5格) | 3格 | Dashboard (5格)
// Bulletin board: 5×3, visual cols 1–5, hangs 1 tile into wall
export const BOARD_COL      = 1
export const BOARD_ROW      = 0
export const BOARD_WALK_COL = 3   // below bulletin board centre
export const BOARD_WALK_ROW = 2

// Dashboard: 5×3, visual cols 8–12, 2-tile gap after board
export const DASH_COL      = 8
export const DASH_ROW      = 0
export const DASH_WALK_COL = 10   // below dashboard centre
export const DASH_WALK_ROW = 2

// Exit door: 2×2, wall-mounted at cols 17–18, hangs 1 tile into wall
export const EXIT_COL      = 17
export const EXIT_WALK_COL = 17   // in front of exit door
export const EXIT_WALK_ROW = 2

// Portal: 2×2, wall-mounted at cols 20–21, hangs 1 tile into wall
export const PORTAL_COL      = 20
export const PORTAL_WALK_COL = 20
export const PORTAL_WALK_ROW = 2

// Character home positions — left zone (Gaia) / right zone (Astraea)
const GAIA_HOME_COL    = 6
const GAIA_HOME_ROW    = 6
const ASTRAEA_HOME_COL = 18
const ASTRAEA_HOME_ROW = 5

function buildGrid(): GridTile[][] {
  const grid: GridTile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: 'FLOOR' as const })),
  )
  grid[BOARD_ROW][BOARD_COL] = { kind: 'BOARD' }
  grid[DASH_ROW][DASH_COL]   = { kind: 'DASHBOARD' }
  return grid
}

const DECORATIONS: Decoration[] = [
  // ── LEFT ZONE: work area (cols 0–13) ──────────────────────────────────────
  // shelf1 (4×2) — left wall, row 4 (moved down 1 tile)
  { col: 0,  row: 4, kind: 'shelf1' },
  // pc desks (2×1.5) — side by side, row 4
  { col: 7,  row: 4, kind: 'pcDesk' },
  { col: 9, row: 4, kind: 'pcDesk' },
  // 4-tile walkway gap: rows 5–8 (no furniture)
  // shelf3 (4×2) — left wall, row 8
  { col: 0,  row: 8, kind: 'shelf3' },
  // shelf2 (4×2) — move to the right side of shelf3 (3-tile gap), for SKILL shelf
  { col: 7,  row: 8, kind: 'shelf2' },

  // ── VERTICAL DIVIDER: pot column at col 14 ────────────────────────────────
  // pots are 1×2 tiles tall → one per 2 rows = continuous green wall
  // rows 1–8 filled; rows 9–11 left open as walkway gap between zones
  { col: 14, row: 1, kind: 'pot1' },
  { col: 14, row: 3, kind: 'pot2' },
  { col: 14, row: 5, kind: 'pot1' },
  { col: 14, row: 7, kind: 'pot2' },

  // ── RIGHT ZONE: lounge / break area (cols 15–21) ──────────────────────────
  // appliances along right edge
  { col: 21, row: 3, kind: 'waterDispenser' },
  { col: 21, row: 5, kind: 'fridge' },
  { col: 15, row: 3, kind: 'vendingMachine' },
  // lounge: black sofa top (2×2), pink sofas ×2 each side, table bottom (2×2)
  { col: 17, row: 8,  kind: 'sofa3' },
  { col: 17, row: 10, kind: 'squareTable' },
  { col: 16, row: 10, kind: 'sofa1' },
  { col: 19, row: 10, kind: 'sofa2' },
  // bottom-right corner pot
  { col: 21, row: 10, kind: 'pot1' },

  // ── TOP-RIGHT: exit door + pot divider + portal (all wall-mounted) ────────
  // Layout on wall: [ExitDoor 17–18] [Pot 19] [Portal 20–21]
  { col: 19, row: 0, kind: 'pot1' },   // divider between exit door and portal
  // Note: exitDoor (col 17) and portal (col 20) are wall-mounted (post-tile pass)
]

export function createWorldState(): WorldState {
  const grid = buildGrid()
  const blockedTiles = computeBlockedTiles(DECORATIONS, DECO_TILE_SIZE)

  // Wall-mounted items occupy grid tiles but aren't in DECORATIONS, block manually.
  // Bulletin board (5×3) → grid rows 0–1, cols 1–5
  // Dashboard (5×3)     → grid rows 0–1, cols 9–13
  // Exit door (2×2)     → grid row 0, cols 17–18
  // Portal (2×2)        → grid row 0, cols 20–21
  for (let dc = 0; dc < 5; dc++) {
    for (let dr = 0; dr < 2; dr++) {
      blockedTiles.add(`${BOARD_COL + dc},${BOARD_ROW + dr}`)
      blockedTiles.add(`${DASH_COL  + dc},${DASH_ROW  + dr}`)
    }
  }
  for (let dc = 0; dc < 2; dc++) {
    blockedTiles.add(`${EXIT_COL + dc},0`)
    blockedTiles.add(`${PORTAL_COL + dc},0`)
  }

  const gaiaHome    = tileCenter(GAIA_HOME_COL,    GAIA_HOME_ROW)
  const astraeaHome = tileCenter(ASTRAEA_HOME_COL, ASTRAEA_HOME_ROW)

  return {
    grid,
    cols: COLS,
    rows: ROWS,
    decorations: DECORATIONS,
    blockedTiles,
    characters: new Map([
      [
        'gaia',
        {
          id: 'gaia',
          displayName: 'Gaia',
          emoji: '🙋',
          statusEmoji: '😶',
          x: gaiaHome.x,
          y: gaiaHome.y,
          col: GAIA_HOME_COL,
          row: GAIA_HOME_ROW,
          homeCol: GAIA_HOME_COL,
          homeRow: GAIA_HOME_ROW,
          state: 'IDLE',
          dir: 'DOWN',
          path: [],
          moveProgress: 0,
          frameTimer: 0,
          frame: 0,
        },
      ],
      [
        'astraea',
        {
          id: 'astraea',
          displayName: 'Astraea',
          emoji: '🧑‍💻',
          statusEmoji: '😶',
          x: astraeaHome.x,
          y: astraeaHome.y,
          col: ASTRAEA_HOME_COL,
          row: ASTRAEA_HOME_ROW,
          homeCol: ASTRAEA_HOME_COL,
          homeRow: ASTRAEA_HOME_ROW,
          state: 'IDLE',
          dir: 'DOWN',
          path: [],
          moveProgress: 0,
          frameTimer: 0,
          frame: 0,
        },
      ],
    ]),
  }
}
