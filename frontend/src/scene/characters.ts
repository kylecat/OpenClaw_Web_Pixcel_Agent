import type { Character, GridTile, Direction } from './types'
import { findPath } from './pathfinding'

export const TILE_SIZE = 64       // CSS px per tile (= 16 source px × 4)
export const WALK_SPEED = 128     // px / sec  (= TILE_SIZE × 2 → 2 tiles/sec)
export const FRAME_DURATION = 0.12 // sec per animation frame

// Transparent padding (in tiles) around the game grid so characters near the
// edges aren't clipped by the canvas boundary
export const SCENE_PAD_L = 0.5   // left
export const SCENE_PAD_R = 0.5   // right
export const SCENE_PAD_T = 1.5   // top  — extra head-room for row-0 walk
export const SCENE_PAD_B = 0.5   // bottom

export function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 }
}

function dirBetween(fc: number, fr: number, tc: number, tr: number): Direction {
  if (tc > fc) return 'RIGHT'
  if (tc < fc) return 'LEFT'
  if (tr > fr) return 'DOWN'
  return 'UP'
}

export function updateCharacter(ch: Character, dt: number): void {
  ch.frameTimer += dt

  if (ch.state === 'IDLE') {
    ch.frame = 1  // rest on idle frame
    return
  }

  // WALK
  if (ch.frameTimer >= FRAME_DURATION) {
    ch.frameTimer -= FRAME_DURATION
    ch.frame = (ch.frame + 1) % 4
  }

  if (ch.path.length === 0) {
    const center = tileCenter(ch.col, ch.row)
    ch.x = center.x
    ch.y = center.y
    ch.state = 'IDLE'
    return
  }

  const next = ch.path[0]
  ch.dir = dirBetween(ch.col, ch.row, next.col, next.row)
  ch.moveProgress += (WALK_SPEED / TILE_SIZE) * dt

  const from = tileCenter(ch.col, ch.row)
  const to = tileCenter(next.col, next.row)
  const t = Math.min(ch.moveProgress, 1)
  ch.x = from.x + (to.x - from.x) * t
  ch.y = from.y + (to.y - from.y) * t

  if (ch.moveProgress >= 1) {
    ch.col = next.col
    ch.row = next.row
    ch.path.shift()
    ch.moveProgress = 0
  }
}

export function walkToTarget(
  ch: Character,
  targetCol: number,
  targetRow: number,
  grid: GridTile[][],
  blocked: Set<string> = new Set(),
): void {
  // Skip if already walking to the same destination (avoids stutter from redundant calls)
  if (ch.state === 'WALK' && ch.path.length > 0) {
    const dest = ch.path[ch.path.length - 1]
    if (dest.col === targetCol && dest.row === targetRow) return
  }
  // Skip if already at the target
  if (ch.col === targetCol && ch.row === targetRow && ch.state === 'IDLE') return

  const path = findPath(ch.col, ch.row, targetCol, targetRow, grid, blocked)
  if (path.length > 0) {
    ch.path = path
    ch.moveProgress = 0
    ch.state = 'WALK'
    ch.frameTimer = 0
    ch.frame = 0
  }
}
