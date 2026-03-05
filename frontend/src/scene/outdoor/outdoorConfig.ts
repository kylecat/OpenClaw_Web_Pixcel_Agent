import type { SceneConfig, WorldState, SelectedObject } from '../core/sceneTypes'
import { ISO_TILE_W, screenToIsoTile } from './isoMath'
import { renderOutdoor, ISO_CANVAS_W, ISO_CANVAS_H, ISO_ORIGIN_X, ISO_ORIGIN_Y } from './outdoorRenderer'
import { createOutdoorWorldState, OUTDOOR_COLS, OUTDOOR_ROWS, CABIN_WALK_COL, CABIN_WALK_ROW, WEATHER_WALK_COL, WEATHER_WALK_ROW, GH1_COL, GH2_COL, GH3_COL, GH_WALK_ROWS } from './outdoorWorldState'
import { loadOutdoorSprites, type OutdoorSprites } from './outdoorSprites'
import { outdoorHitTest } from './outdoorHitTest'

export const outdoorConfig: SceneConfig = {
  id: 'outdoor',
  cols: OUTDOOR_COLS,
  rows: OUTDOOR_ROWS,
  tileSize: ISO_TILE_W,
  padding: {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  walkTargets: {
    cabin:       { col: CABIN_WALK_COL,   row: CABIN_WALK_ROW },
    weather:     { col: WEATHER_WALK_COL,  row: WEATHER_WALK_ROW },
    greenhouse1: { col: GH1_COL + 2,      row: GH_WALK_ROWS[0] },
    greenhouse2: { col: GH2_COL + 2,      row: GH_WALK_ROWS[1] },
    greenhouse3: { col: GH3_COL + 2,      row: GH_WALK_ROWS[2] },
  },
  canvasWidth: ISO_CANVAS_W,
  canvasHeight: ISO_CANVAS_H,
  createWorldState: createOutdoorWorldState,
  loadSprites: loadOutdoorSprites,
  render: (ctx, canvas, world, sprites, selectedObject, pendingTile) => {
    renderOutdoor(ctx, canvas, world, sprites as OutdoorSprites | null, selectedObject, pendingTile)
  },
  hitTest: (logicalX: number, logicalY: number, world: WorldState): SelectedObject | null => {
    // Canvas is displayed at half logical size, so scale coords ×2
    return outdoorHitTest(logicalX * 2, logicalY * 2, world)
  },
  screenToGrid: (logicalX: number, logicalY: number, cols: number, rows: number) => {
    const { col, row } = screenToIsoTile(logicalX * 2, logicalY * 2, ISO_ORIGIN_X, ISO_ORIGIN_Y)
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null
    return { col, row }
  },
}
