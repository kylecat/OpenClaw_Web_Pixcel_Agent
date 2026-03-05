import type { OutdoorTileKind, OutdoorDecorationKind } from '../core/sceneTypes'

/**
 * Outdoor sprites — initially uses programmatic placeholders (colored diamonds).
 * Real pixel-art assets will replace these in T16.
 */
export interface OutdoorSprites {
  tiles: Record<OutdoorTileKind, HTMLCanvasElement>
  decorations: Partial<Record<OutdoorDecorationKind, HTMLCanvasElement>>
}

// Tile fill colors for placeholder diamonds
const TILE_COLORS: Record<OutdoorTileKind, string> = {
  GRASS: '#4a8c3f',
  DIRT:  '#8b6914',
  WATER: '#3a7cbf',
  PATH:  '#c4a46c',
}

// Decoration placeholder colors
const DECO_COLORS: Record<OutdoorDecorationKind, string> = {
  greenhouse1:    '#7ec8a0',
  greenhouse2:    '#6db88e',
  greenhouse3:    '#5ca87c',
  weatherStation: '#a0a0a8',
  cabin:          '#8b5e3c',
  tree1:          '#2d6a1e',
  tree2:          '#3a7d28',
  bush:           '#5a9a3a',
  cropEmpty:      '#9a7840',
  cropGrowing:    '#5b9e3a',
  cropReady:      '#d4a030',
}

// Decoration sizes in pixels for placeholder rendering
import { ISO_TILE_W, ISO_TILE_H } from './isoMath'
import { OUTDOOR_DECO_TILE_SIZE } from './outdoorWorldState'

/**
 * Create a placeholder diamond tile canvas.
 */
function createTilePlaceholder(color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = ISO_TILE_W
  canvas.height = ISO_TILE_H
  const ctx = canvas.getContext('2d')!
  const hw = ISO_TILE_W / 2
  const hh = ISO_TILE_H / 2
  // Diamond shape
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(hw, 0)
  ctx.lineTo(ISO_TILE_W, hh)
  ctx.lineTo(hw, ISO_TILE_H)
  ctx.lineTo(0, hh)
  ctx.closePath()
  ctx.fill()
  // Subtle outline
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1
  ctx.stroke()
  return canvas
}

/**
 * Create a placeholder decoration canvas — a colored diamond scaled to the
 * decoration's tile size, with a label.
 */
function createDecoPlaceholder(
  kind: OutdoorDecorationKind,
  color: string,
): HTMLCanvasElement {
  const size = OUTDOOR_DECO_TILE_SIZE[kind] ?? [1, 1]
  const w = size[0] * ISO_TILE_W
  const h = size[1] * ISO_TILE_H
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const hw = w / 2
  const hh = h / 2
  // Diamond
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(hw, 0)
  ctx.lineTo(w, hh)
  ctx.lineTo(hw, h)
  ctx.lineTo(0, hh)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 2
  ctx.stroke()
  // Label
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(kind, hw, hh)
  return canvas
}

/**
 * Load outdoor sprites. Currently returns programmatic placeholders.
 * In T16, this will load actual PNG assets from /assets/outdoor/.
 */
export async function loadOutdoorSprites(): Promise<OutdoorSprites> {
  // Build tile placeholders
  const tiles = {} as Record<OutdoorTileKind, HTMLCanvasElement>
  for (const [kind, color] of Object.entries(TILE_COLORS)) {
    tiles[kind as OutdoorTileKind] = createTilePlaceholder(color)
  }

  // Build decoration placeholders
  const decorations: Partial<Record<OutdoorDecorationKind, HTMLCanvasElement>> = {}
  for (const [kind, color] of Object.entries(DECO_COLORS)) {
    decorations[kind as OutdoorDecorationKind] = createDecoPlaceholder(
      kind as OutdoorDecorationKind,
      color,
    )
  }

  return { tiles, decorations }
}
