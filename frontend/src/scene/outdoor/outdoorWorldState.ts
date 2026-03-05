import type { WorldState, GridTile, Decoration, OutdoorDecorationKind, OutdoorTileKind } from '../core/sceneTypes'
import { tileCenter } from '../core/characters'
import { computeBlockedTiles } from '../core/collision'

// 16 x 12 isometric grid
export const OUTDOOR_COLS = 16
export const OUTDOOR_ROWS = 12

// Collision / draw sizes for outdoor decorations: [tilesWide, tilesHigh]
export const OUTDOOR_DECO_TILE_SIZE: Partial<Record<OutdoorDecorationKind, [number, number]>> = {
  greenhouse1:    [4, 3],
  greenhouse2:    [4, 3],
  greenhouse3:    [4, 3],
  weatherStation: [2, 2],
  cabin:          [3, 3],
  tree1:          [1, 2],
  tree2:          [1, 2],
  bush:           [1, 1],
  cropEmpty:      [2, 2],
  cropGrowing:    [2, 2],
  cropReady:      [2, 2],
}

// Walk targets for outdoor interactive buildings
export const CABIN_COL       = 1
export const CABIN_ROW       = 5
export const CABIN_WALK_COL  = 4
export const CABIN_WALK_ROW  = 7

export const WEATHER_COL      = 3
export const WEATHER_ROW      = 3
export const WEATHER_WALK_COL = 4
export const WEATHER_WALK_ROW = 5

export const GH1_COL = 6;  export const GH1_ROW = 1
export const GH2_COL = 6;  export const GH2_ROW = 4
export const GH3_COL = 10; export const GH3_ROW = 1
export const GH_WALK_ROWS = [3, 6, 3]  // walk-to row for each greenhouse

// Character home positions in outdoor scene
export const GAIA_OUTDOOR_HOME_COL    = 8
export const GAIA_OUTDOOR_HOME_ROW    = 8
export const ASTRAEA_OUTDOOR_HOME_COL = 12
export const ASTRAEA_OUTDOOR_HOME_ROW = 8

/**
 * Build a 16x12 outdoor tile grid.
 *
 * Layout (reference: 螢幕截圖_室外場景.png):
 *   - Most tiles: GRASS
 *   - River along bottom-left: WATER (row 11, cols 0-5)
 *   - Dirt paths connecting buildings: DIRT
 *   - Walking paths: PATH
 */
function buildOutdoorGrid(): GridTile[][] {
  const grid: GridTile[][] = Array.from({ length: OUTDOOR_ROWS }, () =>
    Array.from({ length: OUTDOOR_COLS }, (): GridTile => ({ kind: 'GRASS' as OutdoorTileKind })),
  )

  // River along bottom edge (row 11, cols 0-7)
  for (let c = 0; c < 8; c++) {
    grid[11][c] = { kind: 'WATER' }
  }
  // River extends partially into row 10
  for (let c = 0; c < 5; c++) {
    grid[10][c] = { kind: 'WATER' }
  }

  // Central dirt paths (cross-shaped farm area)
  // Vertical path: col 8, rows 1-9
  for (let r = 1; r <= 9; r++) {
    grid[r][8] = { kind: 'PATH' }
  }
  // Horizontal path: row 7, cols 4-13
  for (let c = 4; c <= 13; c++) {
    grid[7][c] = { kind: 'PATH' }
  }
  // Path from cabin to central area
  for (let c = 3; c <= 5; c++) {
    grid[7][c] = { kind: 'PATH' }
  }

  // Dirt farm plots
  // Left plots: cols 5-7, rows 4-6 and 8-9
  for (let r = 4; r <= 6; r++) {
    for (let c = 5; c <= 7; c++) {
      grid[r][c] = { kind: 'DIRT' }
    }
  }
  for (let r = 8; r <= 9; r++) {
    for (let c = 5; c <= 7; c++) {
      grid[r][c] = { kind: 'DIRT' }
    }
  }
  // Right plots: cols 9-11, rows 4-6 and 8-9
  for (let r = 4; r <= 6; r++) {
    for (let c = 9; c <= 11; c++) {
      grid[r][c] = { kind: 'DIRT' }
    }
  }
  for (let r = 8; r <= 9; r++) {
    for (let c = 9; c <= 11; c++) {
      grid[r][c] = { kind: 'DIRT' }
    }
  }

  return grid
}

/**
 * Outdoor decorations — based on reference screenshot layout:
 *   Top: tree border
 *   Left: cabin + weather station
 *   Center-right: 3 greenhouses
 *   Center: farm crop plots
 *   Right: more trees
 *   Bottom-left: river
 */
const OUTDOOR_DECORATIONS: Decoration[] = [
  // -- Greenhouses (4x3 each) --
  { col: GH1_COL, row: GH1_ROW, kind: 'greenhouse1' },
  { col: GH2_COL, row: GH2_ROW, kind: 'greenhouse2' },
  { col: GH3_COL, row: GH3_ROW, kind: 'greenhouse3' },

  // -- Weather station (2x2) --
  { col: WEATHER_COL, row: WEATHER_ROW, kind: 'weatherStation' },

  // -- Cabin (3x3) --
  { col: CABIN_COL, row: CABIN_ROW, kind: 'cabin' },

  // -- Crop plots (2x2 each) --
  { col: 5, row: 4, kind: 'cropGrowing' },
  { col: 5, row: 8, kind: 'cropReady' },
  { col: 9, row: 4, kind: 'cropGrowing' },
  { col: 9, row: 8, kind: 'cropEmpty' },

  // -- Tree border (top row) --
  { col: 0,  row: 0, kind: 'tree1' },
  { col: 1,  row: 0, kind: 'tree2' },
  { col: 2,  row: 0, kind: 'tree1' },
  { col: 3,  row: 0, kind: 'tree2' },
  { col: 4,  row: 0, kind: 'tree1' },
  { col: 12, row: 0, kind: 'tree1' },
  { col: 13, row: 0, kind: 'tree2' },
  { col: 14, row: 0, kind: 'tree1' },
  { col: 15, row: 0, kind: 'tree2' },

  // -- Tree border (right edge) --
  { col: 14, row: 2, kind: 'tree2' },
  { col: 15, row: 2, kind: 'tree1' },
  { col: 14, row: 4, kind: 'tree1' },
  { col: 15, row: 4, kind: 'tree2' },
  { col: 14, row: 6, kind: 'tree2' },
  { col: 15, row: 6, kind: 'tree1' },
  { col: 14, row: 8, kind: 'tree1' },
  { col: 15, row: 8, kind: 'tree2' },

  // -- Tree border (left edge) --
  { col: 0, row: 2, kind: 'tree1' },
  { col: 0, row: 4, kind: 'tree2' },
  { col: 0, row: 8, kind: 'tree1' },

  // -- Bushes (scattered) --
  { col: 12, row: 7, kind: 'bush' },
  { col: 13, row: 9, kind: 'bush' },
  { col: 5,  row: 10, kind: 'bush' },

  // -- Tree border (bottom-right) --
  { col: 10, row: 10, kind: 'tree1' },
  { col: 12, row: 10, kind: 'tree2' },
  { col: 14, row: 10, kind: 'tree1' },
  { col: 15, row: 10, kind: 'tree2' },
]

export function createOutdoorWorldState(): WorldState {
  const grid = buildOutdoorGrid()
  const blockedTiles = computeBlockedTiles(OUTDOOR_DECORATIONS, OUTDOOR_DECO_TILE_SIZE)

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
