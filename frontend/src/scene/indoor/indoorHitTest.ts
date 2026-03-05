import type { DecorationKind, WorldState, SelectedObject } from '../core/sceneTypes'
import { TILE_SIZE, SCENE_PAD_L, SCENE_PAD_T } from '../core/characters'
import { CHAR_FRAME_W, CHAR_FRAME_H } from './indoorSprites'
import { BOARD_COL, DASH_COL, EXIT_COL, PORTAL_COL, DECO_TILE_SIZE } from './indoorWorldState'

const OX = SCENE_PAD_L * TILE_SIZE  // 32 px
const OY = SCENE_PAD_T * TILE_SIZE  // 96 px

const CHAR_SCALE = 4
const CHAR_DW = CHAR_FRAME_W * CHAR_SCALE  // 64 px
const CHAR_DH = CHAR_FRAME_H * CHAR_SCALE  // 128 px

/**
 * Hit-test a logical (x, y) point against all interactive objects in the indoor world.
 * Priority order: characters > bulletin board > dashboard > exit door > portal > shelves > decorations.
 */
export function indoorHitTest(
  logicalX: number,
  logicalY: number,
  world: WorldState,
): SelectedObject | null {

  // 1. Characters -- sprite bounding box
  for (const ch of world.characters.values()) {
    const cx = Math.round(ch.x) + OX
    const cy = Math.round(ch.y) + OY
    const dy = cy + TILE_SIZE / 2 - CHAR_DH
    const dx = cx - CHAR_DW / 2
    if (
      logicalX >= dx && logicalX <= dx + CHAR_DW &&
      logicalY >= dy && logicalY <= dy + CHAR_DH
    ) {
      return { kind: 'character', id: ch.id }
    }
  }

  // 2. Bulletin board -- 5x3 tiles
  if (
    logicalX >= OX + BOARD_COL * TILE_SIZE && logicalX <= OX + (BOARD_COL + 5) * TILE_SIZE &&
    logicalY >= OY - TILE_SIZE && logicalY <= OY + 2 * TILE_SIZE
  ) {
    return { kind: 'board' }
  }

  // 3. Dashboard -- 5x3 tiles
  if (
    logicalX >= OX + DASH_COL * TILE_SIZE && logicalX <= OX + (DASH_COL + 5) * TILE_SIZE &&
    logicalY >= OY - TILE_SIZE && logicalY <= OY + 2 * TILE_SIZE
  ) {
    return { kind: 'dashboard' }
  }

  // 4. Exit door -- 2x2, wall-mounted at EXIT_COL, hangs 1 tile into wall
  if (
    logicalX >= OX + EXIT_COL * TILE_SIZE && logicalX <= OX + (EXIT_COL + 2) * TILE_SIZE &&
    logicalY >= OY - TILE_SIZE && logicalY <= OY + TILE_SIZE
  ) {
    return { kind: 'exitDoor' }
  }

  // 5. Portal -- 2x2, wall-mounted at PORTAL_COL, hangs 1 tile into wall
  if (
    logicalX >= OX + PORTAL_COL * TILE_SIZE && logicalX <= OX + (PORTAL_COL + 2) * TILE_SIZE &&
    logicalY >= OY - TILE_SIZE && logicalY <= OY + TILE_SIZE
  ) {
    return { kind: 'portal' }
  }

  // 6. Shelves -- checked before other decorations with extra padding for easier clicking
  const SHELF_PAD = TILE_SIZE * 0.5  // half-tile padding around shelf hit area
  const SHELF_KINDS: Set<DecorationKind> = new Set(['shelf1', 'shelf2', 'shelf3'])
  for (let i = 0; i < world.decorations.length; i++) {
    const deco = world.decorations[i]
    if (!SHELF_KINDS.has(deco.kind)) continue
    const tileSz = DECO_TILE_SIZE[deco.kind]
    if (!tileSz) continue
    const dw = tileSz[0] * TILE_SIZE
    const dh = tileSz[1] * TILE_SIZE
    const x = deco.col * TILE_SIZE + OX
    const y = deco.row * TILE_SIZE + OY
    if (
      logicalX >= x - SHELF_PAD && logicalX <= x + dw + SHELF_PAD &&
      logicalY >= y - SHELF_PAD && logicalY <= y + dh + SHELF_PAD
    ) {
      return { kind: 'decoration', index: i, decoKind: deco.kind }
    }
  }

  // 7. Other decorations -- reverse order so topmost (last-drawn) wins
  for (let i = world.decorations.length - 1; i >= 0; i--) {
    const deco = world.decorations[i]
    if (SHELF_KINDS.has(deco.kind)) continue  // already checked above
    const tileSz = DECO_TILE_SIZE[deco.kind]
    const dw = tileSz ? tileSz[0] * TILE_SIZE : TILE_SIZE
    const dh = tileSz ? tileSz[1] * TILE_SIZE : TILE_SIZE
    const x = deco.col * TILE_SIZE + OX
    const y = deco.row * TILE_SIZE + OY
    if (
      logicalX >= x && logicalX <= x + dw &&
      logicalY >= y && logicalY <= y + dh
    ) {
      return { kind: 'decoration', index: i, decoKind: deco.kind }
    }
  }

  return null
}
