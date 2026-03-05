import type { SceneConfig, WorldState, SelectedObject } from '../core/sceneTypes'
import { TILE_SIZE, SCENE_PAD_L, SCENE_PAD_R, SCENE_PAD_T, SCENE_PAD_B } from '../core/characters'
import { createIndoorWorldState, COLS, ROWS, BOARD_WALK_COL, BOARD_WALK_ROW, DASH_WALK_COL, DASH_WALK_ROW, EXIT_WALK_COL, EXIT_WALK_ROW, PORTAL_WALK_COL, PORTAL_WALK_ROW } from './indoorWorldState'
import { loadIndoorSprites, type IndoorSprites } from './indoorSprites'
import { renderIndoor } from './indoorRenderer'
import { indoorHitTest } from './indoorHitTest'

export const indoorConfig: SceneConfig = {
  id: 'indoor',
  cols: COLS,
  rows: ROWS,
  tileSize: TILE_SIZE,
  padding: {
    left: SCENE_PAD_L,
    right: SCENE_PAD_R,
    top: SCENE_PAD_T,
    bottom: SCENE_PAD_B,
  },
  walkTargets: {
    board:     { col: BOARD_WALK_COL,  row: BOARD_WALK_ROW },
    dashboard: { col: DASH_WALK_COL,   row: DASH_WALK_ROW },
    exitDoor:  { col: EXIT_WALK_COL,   row: EXIT_WALK_ROW },
    portal:    { col: PORTAL_WALK_COL, row: PORTAL_WALK_ROW },
  },
  createWorldState: createIndoorWorldState,
  loadSprites: loadIndoorSprites,
  render: (ctx, canvas, world, sprites, selectedObject, pendingTile) => {
    renderIndoor(ctx, canvas, world, sprites as IndoorSprites | null, selectedObject, pendingTile)
  },
  hitTest: (logicalX: number, logicalY: number, world: WorldState): SelectedObject | null => {
    return indoorHitTest(logicalX, logicalY, world)
  },
}
