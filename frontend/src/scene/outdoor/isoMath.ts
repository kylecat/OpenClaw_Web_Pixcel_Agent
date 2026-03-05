// Isometric tile dimensions (2:1 diamond)
export const ISO_TILE_W = 64
export const ISO_TILE_H = 32

/**
 * Convert grid (col, row) to screen pixel (x, y).
 * Returns the TOP-CENTER of the diamond tile — the anchor point for drawing.
 *
 * Standard isometric projection:
 *   x = (col - row) * halfW + originX
 *   y = (col + row) * halfH + originY
 */
export function isoToScreen(
  col: number,
  row: number,
  originX = 0,
  originY = 0,
): { x: number; y: number } {
  const halfW = ISO_TILE_W / 2
  const halfH = ISO_TILE_H / 2
  return {
    x: (col - row) * halfW + originX,
    y: (col + row) * halfH + originY,
  }
}

/**
 * Convert screen pixel (sx, sy) back to grid (col, row).
 * Inverse of isoToScreen — returns fractional values; use Math.floor/round
 * to snap to the nearest tile.
 */
export function screenToIso(
  sx: number,
  sy: number,
  originX = 0,
  originY = 0,
): { col: number; row: number } {
  const halfW = ISO_TILE_W / 2
  const halfH = ISO_TILE_H / 2
  const rx = sx - originX
  const ry = sy - originY
  return {
    col: (rx / halfW + ry / halfH) / 2,
    row: (ry / halfH - rx / halfW) / 2,
  }
}

/**
 * Snap screen coordinates to the nearest integer grid tile.
 * Convenience wrapper around screenToIso + Math.floor.
 */
export function screenToIsoTile(
  sx: number,
  sy: number,
  originX = 0,
  originY = 0,
): { col: number; row: number } {
  const { col, row } = screenToIso(sx, sy, originX, originY)
  return { col: Math.floor(col), row: Math.floor(row) }
}

/**
 * Depth-sort comparator for painter's algorithm (back-to-front).
 * Objects with smaller (col + row) are further from the camera and drawn first.
 * Tie-break: larger row draws later (objects lower on screen cover upper ones).
 */
export interface IsoSortable {
  col: number
  row: number
}

export function isoDepthSort<T extends IsoSortable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const depthA = a.col + a.row
    const depthB = b.col + b.row
    if (depthA !== depthB) return depthA - depthB
    return a.row - b.row
  })
}

/**
 * Draw a diamond (iso tile) outline at the given screen position.
 * (sx, sy) is the top-center of the diamond (same anchor as isoToScreen).
 */
export function drawIsoDiamond(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  w = ISO_TILE_W,
  h = ISO_TILE_H,
): void {
  const halfW = w / 2
  const halfH = h / 2
  ctx.beginPath()
  ctx.moveTo(sx,          sy)           // top
  ctx.lineTo(sx + halfW,  sy + halfH)   // right
  ctx.lineTo(sx,          sy + h)       // bottom
  ctx.lineTo(sx - halfW,  sy + halfH)   // left
  ctx.closePath()
}

/**
 * Fill a diamond tile with the current fillStyle.
 */
export function fillIsoDiamond(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  w = ISO_TILE_W,
  h = ISO_TILE_H,
): void {
  drawIsoDiamond(ctx, sx, sy, w, h)
  ctx.fill()
}

/**
 * Stroke a diamond tile with the current strokeStyle.
 */
export function strokeIsoDiamond(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  w = ISO_TILE_W,
  h = ISO_TILE_H,
): void {
  drawIsoDiamond(ctx, sx, sy, w, h)
  ctx.stroke()
}
