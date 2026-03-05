import type { Decoration, DecorationKind, WorldState, SelectedObject } from './types'
import { TILE_SIZE, SCENE_PAD_L, SCENE_PAD_T } from './characters'
import { CHAR_FRAME_W, CHAR_FRAME_H } from './spriteLoader'
import { BOARD_COL, DASH_COL } from './worldState'

const OX = SCENE_PAD_L * TILE_SIZE  // 32 px
const OY = SCENE_PAD_T * TILE_SIZE  // 96 px

const CHAR_SCALE = 4
const CHAR_DW = CHAR_FRAME_W * CHAR_SCALE  // 64 px
const CHAR_DH = CHAR_FRAME_H * CHAR_SCALE  // 128 px

// ── Collision ────────────────────────────────────────────────────────────────

// Decorations that are drawn on the floor but do NOT block character movement.
const WALKABLE_DECOS: Set<DecorationKind> = new Set(['portal'])

/**
 * Compute which grid tiles are fully or partially occupied by decorations.
 * Uses Math.ceil on fractional heights so partial tiles (e.g. pcDesk 1.5h) are
 * treated as blocked — characters won't walk through furniture.
 *
 * Returns a Set of "col,row" strings for fast O(1) lookup in pathfinding.
 */
export function computeBlockedTiles(
  decorations: Decoration[],
  decoTileSize: Partial<Record<DecorationKind, [number, number]>>,
): Set<string> {
  const blocked = new Set<string>()
  for (const deco of decorations) {
    if (WALKABLE_DECOS.has(deco.kind)) continue  // walkable floor decoration
    const size = decoTileSize[deco.kind]
    if (!size) continue   // pixel-art fallback decorations — no collision data
    const [w, h] = size
    for (let dc = 0; dc < Math.ceil(w); dc++) {
      for (let dr = 0; dr < Math.ceil(h); dr++) {
        blocked.add(`${deco.col + dc},${deco.row + dr}`)
      }
    }
  }
  return blocked
}

// ── Hit-test ─────────────────────────────────────────────────────────────────

/**
 * Convert a CSS-pixel mouse coordinate (relative to the canvas element) into
 * a logical-pixel coordinate that matches the drawing coordinate system.
 *
 * The canvas is displayed at CSS_SCALE × its logical size.
 */
export function cssToLogical(
  cssX: number,
  cssY: number,
  cssScale: number,
): { x: number; y: number } {
  return { x: cssX / cssScale, y: cssY / cssScale }
}

/**
 * Hit-test a logical (x, y) point against all interactive objects in the world.
 * Priority order: characters > bulletin board > dashboard > decorations.
 *
 * @param logicalX  x in the same coordinate space used by the renderer (OX/OY offset space)
 * @param logicalY  y in the same coordinate space
 */
export function hitTest(
  logicalX: number,
  logicalY: number,
  world: WorldState,
  decoTileSize: Partial<Record<DecorationKind, [number, number]>>,
): SelectedObject | null {

  // 1. Characters — sprite bounding box
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

  // 2. Bulletin board — 5×3 tiles
  if (
    logicalX >= OX + BOARD_COL * TILE_SIZE && logicalX <= OX + (BOARD_COL + 5) * TILE_SIZE &&
    logicalY >= OY - TILE_SIZE && logicalY <= OY + 2 * TILE_SIZE
  ) {
    return { kind: 'board' }
  }

  // 3. Dashboard — 5×3 tiles
  if (
    logicalX >= OX + DASH_COL * TILE_SIZE && logicalX <= OX + (DASH_COL + 5) * TILE_SIZE &&
    logicalY >= OY - TILE_SIZE && logicalY <= OY + 2 * TILE_SIZE
  ) {
    return { kind: 'dashboard' }
  }

  // 4. Decorations — reverse order so topmost (last-drawn) wins
  for (let i = world.decorations.length - 1; i >= 0; i--) {
    const deco = world.decorations[i]
    const tileSz = decoTileSize[deco.kind]
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
