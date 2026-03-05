import type { Decoration, DecorationKind } from './sceneTypes'

// Decorations that are drawn on the floor but do NOT block character movement.
const WALKABLE_DECOS: Set<DecorationKind> = new Set(['portal'])

/**
 * Compute which grid tiles are fully or partially occupied by decorations.
 * Uses Math.ceil on fractional heights so partial tiles (e.g. pcDesk 1.5h) are
 * treated as blocked -- characters won't walk through furniture.
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
    if (!size) continue   // pixel-art fallback decorations -- no collision data
    const [w, h] = size
    for (let dc = 0; dc < Math.ceil(w); dc++) {
      for (let dr = 0; dr < Math.ceil(h); dr++) {
        blocked.add(`${deco.col + dc},${deco.row + dr}`)
      }
    }
  }
  return blocked
}

/**
 * Convert a CSS-pixel mouse coordinate (relative to the canvas element) into
 * a logical-pixel coordinate that matches the drawing coordinate system.
 *
 * Uses the actual bounding-rect size of the canvas element so the mapping
 * stays correct regardless of CSS scaling, browser rounding, or DPR.
 */
export function cssToLogical(
  cssX: number,
  cssY: number,
  rectWidth: number,
  rectHeight: number,
  logicalWidth: number,
  logicalHeight: number,
): { x: number; y: number } {
  return {
    x: cssX * (logicalWidth  / rectWidth),
    y: cssY * (logicalHeight / rectHeight),
  }
}
