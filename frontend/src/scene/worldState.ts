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
}

// 32 × 64 px = 2048 px wide
// 12 × 64 px =  768 px tall  → canvas exactly 2048 × 768
export const COLS = 32
export const ROWS = 12

// Target tile coords
// Bulletin board: 5×3, visual cols 0–4, rows -0.5 to 1.5 (hangs into wall)
export const BOARD_COL      = 0
export const BOARD_ROW      = 0
export const BOARD_WALK_COL = 2   // below bulletin board centre
export const BOARD_WALK_ROW = 2

// Dashboard: 5×3, visual cols 6–10 (1-tile gap after board), same y as board
export const DASH_COL      = 6
export const DASH_ROW      = 0
export const DASH_WALK_COL = 8   // below dashboard centre
export const DASH_WALK_ROW = 2

// Character home positions — left zone (Gaia) / right zone (Astraea)
const GAIA_HOME_COL    = 6
const GAIA_HOME_ROW    = 6
const ASTRAEA_HOME_COL = 22
const ASTRAEA_HOME_ROW = 7

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
  // shelf1 (4×2) — left wall, row 3 (down 2 from original row 1)
  { col: 0,  row: 3, kind: 'shelf1' },
  // pc desks (2×1.5) to the right of shelf1, same row band
  { col: 5,  row: 3, kind: 'pcDesk' },
  { col: 10, row: 3, kind: 'pcDesk' },
  // 4-tile walkway gap: rows 5–8 (no furniture)
  // shelf2 (4×2) — left wall, row 9 (4-tile gap after shelf1 ends at row 4)
  { col: 0,  row: 9, kind: 'shelf2' },

  // ── VERTICAL DIVIDER: pot column at col 14 ────────────────────────────────
  // pots are 1×2 tiles tall → one per 2 rows = continuous green wall
  // rows 1–8 filled; rows 9–11 left open as walkway gap between zones
  { col: 14, row: 1, kind: 'pot1' },
  { col: 14, row: 3, kind: 'pot2' },
  { col: 14, row: 5, kind: 'pot1' },
  { col: 14, row: 7, kind: 'pot2' },

  // ── RIGHT ZONE: lounge / break area (cols 15–31) ──────────────────────────
  // lounge: square table (2×2) + sofas (1×2, 1×2, 2×2)
  { col: 17, row: 7,  kind: 'squareTable' },
  { col: 16, row: 9,  kind: 'sofa1' },
  { col: 20, row: 9,  kind: 'sofa2' },
  { col: 17, row: 10, kind: 'sofa3' },
  // appliances on right wall
  { col: 28, row: 5, kind: 'waterDispenser' },
  { col: 29, row: 7, kind: 'vendingMachine' },
  { col: 28, row: 9, kind: 'fridge' },
]

export function createWorldState(): WorldState {
  const grid = buildGrid()
  const blockedTiles = computeBlockedTiles(DECORATIONS, DECO_TILE_SIZE)

  // Bulletin board (5×3, hangs 1 tile into wall) occupies grid rows 0–1, cols 0–4
  // Dashboard (5×3, same hang) occupies grid rows 0–1, cols 6–10
  // Neither is in DECORATIONS, so we block their on-grid tiles manually.
  for (let dc = 0; dc < 5; dc++) {
    for (let dr = 0; dr < 2; dr++) {
      blockedTiles.add(`${BOARD_COL + dc},${BOARD_ROW + dr}`)
      blockedTiles.add(`${DASH_COL  + dc},${DASH_ROW  + dr}`)
    }
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
