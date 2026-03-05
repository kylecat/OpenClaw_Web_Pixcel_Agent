import type { WorldState, SelectedObject, OutdoorDecorationKind } from '../core/sceneTypes'
import { TILE_SIZE } from '../core/characters'
import { ISO_TILE_W, ISO_TILE_H, screenToIso } from './isoMath'
import { ISO_ORIGIN_X, ISO_ORIGIN_Y } from './outdoorRenderer'
import { OUTDOOR_DECO_TILE_SIZE } from './outdoorWorldState'

const HALF_W = ISO_TILE_W / 2
const HALF_H = ISO_TILE_H / 2

// Character hit area (simplified bounding box around emoji)
const CHAR_HIT_W = 48
const CHAR_HIT_H = 64

/**
 * Test if a point (px, py) is inside an isometric diamond centered at (cx, cy).
 */
function pointInDiamond(
  px: number, py: number,
  cx: number, cy: number,
  halfW: number, halfH: number,
): boolean {
  // Diamond test: |dx/halfW| + |dy/halfH| <= 1
  const dx = Math.abs(px - cx) / halfW
  const dy = Math.abs(py - cy) / halfH
  return (dx + dy) <= 1
}

/**
 * Hit-test for the outdoor isometric scene.
 * Priority: characters > buildings (greenhouse/cabin/weather) > decorations > ground tile.
 */
export function outdoorHitTest(
  logicalX: number,
  logicalY: number,
  world: WorldState,
): SelectedObject | null {

  // 1. Characters
  for (const ch of world.characters.values()) {
    const gc = ch.x / TILE_SIZE
    const gr = ch.y / TILE_SIZE
    const sx = (gc - gr) * HALF_W + ISO_ORIGIN_X
    const sy = (gc + gr) * HALF_H + ISO_ORIGIN_Y + HALF_H  // foot position
    const dx = sx - CHAR_HIT_W / 2
    const dy = sy - CHAR_HIT_H
    if (
      logicalX >= dx && logicalX <= dx + CHAR_HIT_W &&
      logicalY >= dy && logicalY <= dy + CHAR_HIT_H
    ) {
      return { kind: 'character', id: ch.id }
    }
  }

  // 2. Interactive buildings — check by decoration kind
  const BUILDING_KINDS: Record<string, (index: number) => SelectedObject> = {
    greenhouse1: () => ({ kind: 'greenhouse', index: 0 }),
    greenhouse2: () => ({ kind: 'greenhouse', index: 1 }),
    greenhouse3: () => ({ kind: 'greenhouse', index: 2 }),
    weatherStation: () => ({ kind: 'weatherStation' }),
    cabin: () => ({ kind: 'cabin' }),
  }

  // Check buildings (largest first for easier clicking)
  for (let i = 0; i < world.decorations.length; i++) {
    const deco = world.decorations[i]
    const factory = BUILDING_KINDS[deco.kind]
    if (!factory) continue
    const size = OUTDOOR_DECO_TILE_SIZE[deco.kind as OutdoorDecorationKind] ?? [1, 1]
    const cc = deco.col + size[0] / 2
    const cr = deco.row + size[1] / 2
    const cx = (cc - cr) * HALF_W + ISO_ORIGIN_X
    const cy = (cc + cr) * HALF_H + ISO_ORIGIN_Y
    if (pointInDiamond(logicalX, logicalY, cx, cy, size[0] * HALF_W, size[1] * HALF_H)) {
      return factory(i)
    }
  }

  // 3. Other decorations (trees, crops, bushes)
  for (let i = world.decorations.length - 1; i >= 0; i--) {
    const deco = world.decorations[i]
    if (BUILDING_KINDS[deco.kind]) continue  // already checked
    const size = OUTDOOR_DECO_TILE_SIZE[deco.kind as OutdoorDecorationKind] ?? [1, 1]
    const cc = deco.col + size[0] / 2
    const cr = deco.row + size[1] / 2
    const cx = (cc - cr) * HALF_W + ISO_ORIGIN_X
    const cy = (cc + cr) * HALF_H + ISO_ORIGIN_Y
    if (pointInDiamond(logicalX, logicalY, cx, cy, size[0] * HALF_W, size[1] * HALF_H)) {
      return { kind: 'decoration', index: i, decoKind: deco.kind }
    }
  }

  // 4. Ground tile
  const { col, row } = screenToIso(logicalX, logicalY, ISO_ORIGIN_X, ISO_ORIGIN_Y)
  const tileCol = Math.floor(col)
  const tileRow = Math.floor(row)
  if (tileCol >= 0 && tileCol < world.cols && tileRow >= 0 && tileRow < world.rows) {
    // Return null — clicking empty ground deselects (handled by SceneCanvas)
    return null
  }

  return null
}
