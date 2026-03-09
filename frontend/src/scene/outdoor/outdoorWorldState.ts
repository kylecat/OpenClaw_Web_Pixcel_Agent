import type { WorldState, GridTile, Decoration, OutdoorDecorationKind, OutdoorTileKind } from '../core/sceneTypes'
import { tileCenter } from '../core/characters'
import { computeBlockedTiles } from '../core/collision'

// 64 x 48 isometric grid (16× area of original 16×12)
export const OUTDOOR_COLS = 64
export const OUTDOOR_ROWS = 48

// Collision / draw sizes for outdoor decorations: [tilesWide, tilesHigh]
// Main elements are 2× larger to fill the 64×48 grid properly
export const OUTDOOR_DECO_TILE_SIZE: Partial<Record<OutdoorDecorationKind, [number, number]>> = {
  greenhouse1:      [6, 8],
  greenhouse2:      [6, 8],
  greenhouse3:      [6, 8],
  weatherStation:   [4, 4],
  cabin:            [6, 6],
  windTurbine:      [4, 4],
  tree1:            [1, 2],
  tree2:            [1, 2],
  bush:             [1, 1],
  cropEmpty:        [4, 4],
  cropGrowing:      [4, 4],
  cropReady:        [4, 4],
  cropLongGrowing:  [3, 9],
  cropLongCovered:  [3, 9],
  cropLongHarvest:  [3, 9],
}

// Walk targets for outdoor interactive buildings
// Cabin & weather station: bottom-left area
// 3 greenhouses: side by side in top-center
export const CABIN_COL       = 8
export const CABIN_ROW       = 26
export const CABIN_WALK_COL  = 14
export const CABIN_WALK_ROW  = 33

export const WEATHER_COL      = 8
export const WEATHER_ROW      = 18
export const WEATHER_WALK_COL = 12
export const WEATHER_WALK_ROW = 23

// 3 greenhouses side by side (each 8 wide now), same row — shifted S by 2
export const GH1_COL = 14; export const GH1_ROW = 12
export const GH2_COL = 24; export const GH2_ROW = 12
export const GH3_COL = 34; export const GH3_ROW = 12
export const GH_WALK_ROWS = [22, 22, 22]  // walk-to row for each greenhouse

// Character home positions — in the open grass area between paths and crop plots
export const GAIA_OUTDOOR_HOME_COL    = 28
export const GAIA_OUTDOOR_HOME_ROW    = 24
export const ASTRAEA_OUTDOOR_HOME_COL = 40
export const ASTRAEA_OUTDOOR_HOME_ROW = 24

/**
 * Build a 64x48 outdoor tile grid.
 */
function buildOutdoorGrid(): GridTile[][] {
  const grid: GridTile[][] = Array.from({ length: OUTDOOR_ROWS }, () =>
    Array.from({ length: OUTDOOR_COLS }, (): GridTile => ({ kind: 'GRASS' as OutdoorTileKind })),
  )

  // River along bottom-left (diagonal, matching reference)
  for (let c = 0; c < 32; c++) {
    grid[47][c] = { kind: 'WATER' }
  }
  for (let c = 0; c < 28; c++) {
    grid[46][c] = { kind: 'WATER' }
  }
  for (let c = 0; c < 20; c++) {
    grid[45][c] = { kind: 'WATER' }
  }
  for (let c = 0; c < 12; c++) {
    grid[44][c] = { kind: 'WATER' }
  }

  // Paths connecting buildings (2 tiles wide)
  // Horizontal path below greenhouses: rows 20-21, cols 14-48
  for (let c = 14; c <= 48; c++) {
    grid[20][c] = { kind: 'PATH' }
    grid[21][c] = { kind: 'PATH' }
  }
  // Vertical path from cabin/weather area: cols 14-15, rows 20-34
  for (let r = 20; r <= 34; r++) {
    grid[r][14] = { kind: 'PATH' }
    grid[r][15] = { kind: 'PATH' }
  }
  // Horizontal path from cabin: rows 32-33, cols 14-16
  for (let c = 14; c <= 16; c++) {
    grid[32][c] = { kind: 'PATH' }
    grid[33][c] = { kind: 'PATH' }
  }

  // Dirt for crop area: cols 18-49, rows 28-31
  for (let r = 28; r <= 31; r++) {
    for (let c = 18; c <= 49; c++) {
      grid[r][c] = { kind: 'DIRT' }
    }
  }

  return grid
}

/**
 * Outdoor decorations — 64×48 grid:
 *   Dense tree border, 3 greenhouses side by side (top-center),
 *   Cabin + weather station (bottom-left), minimal crops, river bottom-left
 */
const OUTDOOR_DECORATIONS: Decoration[] = [
  // -- 3 Greenhouses side by side (4×3 each) --
  { col: GH1_COL, row: GH1_ROW, kind: 'greenhouse1' },
  { col: GH2_COL, row: GH2_ROW, kind: 'greenhouse2' },
  { col: GH3_COL, row: GH3_ROW, kind: 'greenhouse3' },

  // -- Cabin (3×3) — bottom-left --
  { col: CABIN_COL, row: CABIN_ROW, kind: 'cabin' },

  // -- Weather station (2×2) — above cabin --
  { col: WEATHER_COL, row: WEATHER_ROW, kind: 'weatherStation' },

  // -- Wind turbine — near weather station --
  { col: 50, row: 10, kind: 'windTurbine' },

  // -- 4 long crop plots (8×4 each), same row=28, spaced along col axis --
  { col: 18, row: 28, kind: 'cropLongGrowing' },
  { col: 26, row: 28, kind: 'cropLongCovered' },
  { col: 34, row: 28, kind: 'cropLongHarvest' },
  { col: 42, row: 28, kind: 'cropLongGrowing' },

  // ===== Tree border (halved density for performance) =====
  // -- Top border (rows 0, 4 — 2 rows instead of 4) --
  ...Array.from({ length: 64 }, (_, c) => ({
    col: c, row: 0, kind: (c % 2 === 0 ? 'tree1' : 'tree2') as OutdoorDecorationKind,
  })),
  ...Array.from({ length: 64 }, (_, c) => ({
    col: c, row: 4, kind: (c % 2 === 1 ? 'tree2' : 'tree1') as OutdoorDecorationKind,
  })),

  // -- Left border (col 0 only — 1 col, rows 8-39) --
  ...Array.from({ length: 16 }, (_, i) => ({
    col: 0, row: 8 + i * 2, kind: (i % 2 === 0 ? 'tree1' : 'tree2') as OutdoorDecorationKind,
  })),

  // -- Right border (cols 58, 60, 62, 63 — 4 cols instead of 8, rows 8-39) --
  ...Array.from({ length: 16 }, (_, i) => ({
    col: 58, row: 8 + i * 2, kind: (i % 2 === 0 ? 'tree2' : 'tree1') as OutdoorDecorationKind,
  })),
  ...Array.from({ length: 16 }, (_, i) => ({
    col: 60, row: 8 + i * 2, kind: (i % 2 === 0 ? 'tree1' : 'tree2') as OutdoorDecorationKind,
  })),
  ...Array.from({ length: 16 }, (_, i) => ({
    col: 62, row: 8 + i * 2, kind: (i % 2 === 0 ? 'tree2' : 'tree1') as OutdoorDecorationKind,
  })),
  ...Array.from({ length: 16 }, (_, i) => ({
    col: 63, row: 8 + i * 2, kind: (i % 2 === 1 ? 'tree2' : 'tree1') as OutdoorDecorationKind,
  })),

  // -- Bottom border (rows 38, 42 — 2 rows instead of 3, right side; left has river) --
  ...Array.from({ length: 32 }, (_, c) => ({
    col: 32 + c, row: 38, kind: (c % 2 === 0 ? 'tree1' : 'tree2') as OutdoorDecorationKind,
  })),
  ...Array.from({ length: 32 }, (_, c) => ({
    col: 32 + c, row: 42, kind: (c % 2 === 0 ? 'tree2' : 'tree1') as OutdoorDecorationKind,
  })),
  // Bottom-left trees above river
  ...Array.from({ length: 6 }, (_, c) => ({
    col: 12 + c * 4, row: 38, kind: (c % 2 === 0 ? 'tree2' : 'tree1') as OutdoorDecorationKind,
  })),

  // -- Bushes scattered --
  { col: 18, row: 16, kind: 'bush' },
  { col: 52, row: 16, kind: 'bush' },
  { col: 18, row: 28, kind: 'bush' },
  { col: 50, row: 28, kind: 'bush' },
]

export function createOutdoorWorldState(): WorldState {
  const grid = buildOutdoorGrid()
  // Trees and bushes are visual-only in the outdoor scene — don't block movement
  const outdoorWalkable: Set<OutdoorDecorationKind> = new Set(['tree1', 'tree2', 'bush'])
  const blockedTiles = computeBlockedTiles(OUTDOOR_DECORATIONS, OUTDOOR_DECO_TILE_SIZE, outdoorWalkable)

  // Water tiles are also blocked
  for (let r = 0; r < OUTDOOR_ROWS; r++) {
    for (let c = 0; c < OUTDOOR_COLS; c++) {
      if (grid[r][c].kind === 'WATER') {
        blockedTiles.add(`${c},${r}`)
      }
    }
  }

  const gaiaHome    = tileCenter(GAIA_OUTDOOR_HOME_COL,    GAIA_OUTDOOR_HOME_ROW)
  const astraeaHome = tileCenter(ASTRAEA_OUTDOOR_HOME_COL, ASTRAEA_OUTDOOR_HOME_ROW)

  return {
    grid,
    cols: OUTDOOR_COLS,
    rows: OUTDOOR_ROWS,
    decorations: OUTDOOR_DECORATIONS,
    blockedTiles,
    characters: new Map([
      [
        'gaia',
        {
          id: 'gaia',
          displayName: 'Gaia',
          emoji: '\u{1F64B}',
          statusEmoji: '\u{1F636}',
          x: gaiaHome.x,
          y: gaiaHome.y,
          col: GAIA_OUTDOOR_HOME_COL,
          row: GAIA_OUTDOOR_HOME_ROW,
          homeCol: GAIA_OUTDOOR_HOME_COL,
          homeRow: GAIA_OUTDOOR_HOME_ROW,
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
          emoji: '\u{1F9D1}\u200D\u{1F4BB}',
          statusEmoji: '\u{1F636}',
          x: astraeaHome.x,
          y: astraeaHome.y,
          col: ASTRAEA_OUTDOOR_HOME_COL,
          row: ASTRAEA_OUTDOOR_HOME_ROW,
          homeCol: ASTRAEA_OUTDOOR_HOME_COL,
          homeRow: ASTRAEA_OUTDOOR_HOME_ROW,
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
