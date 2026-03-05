import type { WorldState, SelectedObject, DecorationKind, OutdoorTileKind } from '../core/sceneTypes'
import type { OutdoorSprites } from './outdoorSprites'
import { TILE_SIZE, tileCenter } from '../core/characters'
import { CHAR_FRAME_W, CHAR_FRAME_H, DIR_ROW, WALK_FRAMES, IDLE_FRAME } from '../indoor/indoorSprites'
import { ISO_TILE_W, ISO_TILE_H, isoToScreen, isoDepthSort, drawIsoDiamond } from './isoMath'
import { OUTDOOR_COLS, OUTDOOR_ROWS, OUTDOOR_DECO_TILE_SIZE } from './outdoorWorldState'

// Character sprite drawn at 4x scale (reuse indoor sprites for Phase 1)
const CHAR_SCALE = 4
const CHAR_DW = CHAR_FRAME_W * CHAR_SCALE  // 64
const CHAR_DH = CHAR_FRAME_H * CHAR_SCALE  // 128

// ISO direction remapping: grid directions → sprite sheet directions
// Grid UP (north) → NW → use LEFT sprite; DOWN → SE → DOWN; LEFT → SW → LEFT mirror; RIGHT → NE → RIGHT
const ISO_DIR_REMAP: Record<string, string> = {
  UP:    'LEFT',
  DOWN:  'DOWN',
  LEFT:  'LEFT',
  RIGHT: 'RIGHT',
}

// Canvas logical dimensions — isometric grid needs more width than height.
// Origin is placed so that tile (0,0) top-center starts at (originX, originY).
// With OUTDOOR_COLS=16 and OUTDOOR_ROWS=12, the grid spans roughly:
//   x: from -(ROWS-1)*halfW to +(COLS-1)*halfW
//   y: from 0 to (COLS+ROWS-2)*halfH
const HALF_W = ISO_TILE_W / 2
const HALF_H = ISO_TILE_H / 2
// Compute origin so the entire grid fits with padding
const GRID_MIN_X = -(OUTDOOR_ROWS - 1) * HALF_W
const GRID_MAX_X = (OUTDOOR_COLS - 1) * HALF_W
const GRID_MAX_Y = (OUTDOOR_COLS + OUTDOOR_ROWS - 2) * HALF_H + ISO_TILE_H

const PAD = 48  // px padding around the grid
export const ISO_CANVAS_W = (GRID_MAX_X - GRID_MIN_X) + ISO_TILE_W + PAD * 2
export const ISO_CANVAS_H = GRID_MAX_Y + PAD * 2

// Origin: offset so tile (0,0) is horizontally centered and vertically padded
export const ISO_ORIGIN_X = -GRID_MIN_X + HALF_W + PAD
export const ISO_ORIGIN_Y = PAD

/**
 * Render the outdoor isometric scene.
 */
export function renderOutdoor(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  world: WorldState,
  sprites: OutdoorSprites | null,
  selectedObject: SelectedObject | null = null,
  pendingTile: { col: number; row: number } | null = null,
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const scaleX = canvas.width / ISO_CANVAS_W
  const scaleY = canvas.height / ISO_CANVAS_H
  ctx.save()
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)

  // Background
  ctx.fillStyle = '#2d5a1e'
  ctx.fillRect(0, 0, ISO_CANVAS_W, ISO_CANVAS_H)

  // -- Ground pass: draw tiles back-to-front (row by row, col by col) --
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const tile = world.grid[row][col]
      const { x: sx, y: sy } = isoToScreen(col, row, ISO_ORIGIN_X, ISO_ORIGIN_Y)

      if (sprites) {
        const tileCanvas = sprites.tiles[tile.kind as OutdoorTileKind]
        if (tileCanvas) {
          ctx.drawImage(tileCanvas, sx - HALF_W, sy, ISO_TILE_W, ISO_TILE_H)
        }
      } else {
        // Fallback: colored diamond
        const colors: Record<string, string> = {
          GRASS: '#4a8c3f', DIRT: '#8b6914', WATER: '#3a7cbf', PATH: '#c4a46c',
        }
        ctx.fillStyle = colors[tile.kind] ?? '#4a8c3f'
        drawIsoDiamond(ctx, sx, sy)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }
  }

  // -- Pending move target --
  if (pendingTile) {
    const { x: px, y: py } = isoToScreen(pendingTile.col, pendingTile.row, ISO_ORIGIN_X, ISO_ORIGIN_Y)
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200)
    ctx.save()
    ctx.fillStyle = `rgba(255, 220, 60, ${0.25 + 0.2 * pulse})`
    drawIsoDiamond(ctx, px, py)
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 220, 60, ${0.7 + 0.3 * pulse})`
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // -- Depth-sorted pass: decorations + characters --
  // Build sortable items
  interface Sortable { col: number; row: number; type: 'deco' | 'char'; index: number; id?: string }
  const sortables: Sortable[] = []

  for (let i = 0; i < world.decorations.length; i++) {
    const d = world.decorations[i]
    // Use bottom-row of decoration for depth sorting
    const size = OUTDOOR_DECO_TILE_SIZE[d.kind as keyof typeof OUTDOOR_DECO_TILE_SIZE]
    const depthRow = d.row + (size ? size[1] - 1 : 0)
    const depthCol = d.col + (size ? size[0] - 1 : 0)
    sortables.push({ col: depthCol, row: depthRow, type: 'deco', index: i })
  }

  for (const ch of world.characters.values()) {
    // Use fractional grid position for smooth depth sorting during walks
    const fracCol = ch.x / TILE_SIZE
    const fracRow = ch.y / TILE_SIZE
    sortables.push({ col: fracCol, row: fracRow, type: 'char', index: 0, id: ch.id })
  }

  const sorted = isoDepthSort(sortables)

  for (const item of sorted) {
    if (item.type === 'deco') {
      renderDecoration(ctx, world, sprites, item.index)
    } else if (item.id) {
      renderCharacter(ctx, world, sprites, item.id)
    }
  }

  // -- Movement paths --
  renderPaths(ctx, world)

  // -- Selection highlight --
  if (selectedObject) {
    renderSelection(ctx, world, selectedObject)
  }

  ctx.restore()
}

// -- Decoration rendering --
function renderDecoration(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  sprites: OutdoorSprites | null,
  index: number,
): void {
  const deco = world.decorations[index]
  if (!deco) return
  const size = OUTDOOR_DECO_TILE_SIZE[deco.kind as keyof typeof OUTDOOR_DECO_TILE_SIZE] ?? [1, 1]
  // Anchor at center of decoration footprint
  const centerCol = deco.col + size[0] / 2
  const centerRow = deco.row + size[1] / 2
  const { x: sx, y: sy } = isoToScreen(centerCol, centerRow, ISO_ORIGIN_X, ISO_ORIGIN_Y)
  const dw = size[0] * ISO_TILE_W
  const dh = size[1] * ISO_TILE_H

  if (sprites?.decorations[deco.kind as keyof typeof sprites.decorations]) {
    const img = sprites.decorations[deco.kind as keyof typeof sprites.decorations]!
    ctx.drawImage(img, sx - dw / 2, sy - dh / 2, dw, dh)
  } else {
    // Fallback: colored diamond
    ctx.fillStyle = 'rgba(100,100,100,0.5)'
    drawIsoDiamond(ctx, sx, sy - dh / 2 + HALF_H, dw, dh)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
    // Label
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(deco.kind, sx, sy)
  }
}

// -- Character rendering (Phase 1: reuse indoor 4-direction sprites) --
function renderCharacter(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  _sprites: OutdoorSprites | null,
  charId: string,
): void {
  const ch = world.characters.get(charId)
  if (!ch) return

  // Convert character grid position to isometric screen coords
  // ch.x/y are in tile-pixel space (center of tile), convert to grid fractions
  const gridCol = ch.x / TILE_SIZE
  const gridRow = ch.y / TILE_SIZE
  const { x: sx, y: sy } = isoToScreen(gridCol, gridRow, ISO_ORIGIN_X, ISO_ORIGIN_Y)

  // Character anchor: feet at tile center, sprite extends upward
  const footY = sy + HALF_H
  const drawX = sx - CHAR_DW / 2
  const drawY = footY - CHAR_DH

  // Shadow ellipse
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(sx, footY - 2, 14, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Try to load indoor character sprites (shared between scenes)
  // Access via global sprite loading — for now use emoji fallback
  // Phase 1: emoji-based rendering (character sprites loaded in T16)
  const remappedDir = ISO_DIR_REMAP[ch.dir] ?? ch.dir
  void remappedDir  // will be used when sprite sheets are available

  // Emoji fallback (until sprite sheets are integrated)
  const bounce = ch.state === 'WALK'
    ? Math.sin(ch.frameTimer * Math.PI / 0.12) * 2
    : 0
  ctx.font = `${TILE_SIZE * 0.5}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(ch.emoji, sx, footY - 4 + bounce)

  // Status emoji bubble
  const bubbleR = 14
  const bx = sx + 20
  const by = drawY + bubbleR + 8
  ctx.beginPath()
  ctx.arc(bx, by, bubbleR, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.font = '22px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch.statusEmoji, bx, by + 1)

  // Name label
  ctx.font = 'bold 9px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText(`[ ${ch.displayName.toUpperCase()} ]`, sx, footY + 2)
}

// -- Path visualization --
function renderPaths(ctx: CanvasRenderingContext2D, world: WorldState): void {
  const DOT_PATTERN: number[] = [12, 24, 0, 24]
  const PATTERN_LEN = DOT_PATTERN.reduce((s, v) => s + v, 0)
  const dashOffset = -(performance.now() / 60) % PATTERN_LEN

  for (const ch of world.characters.values()) {
    if (ch.path.length === 0) continue

    const gridCol = ch.x / TILE_SIZE
    const gridRow = ch.y / TILE_SIZE
    const start = isoToScreen(gridCol, gridRow, ISO_ORIGIN_X, ISO_ORIGIN_Y)

    const pts = [
      { x: start.x, y: start.y + HALF_H },
      ...ch.path.map((wp) => {
        const c = tileCenter(wp.col, wp.row)
        const gc = c.x / TILE_SIZE
        const gr = c.y / TILE_SIZE
        const s = isoToScreen(gc, gr, ISO_ORIGIN_X, ISO_ORIGIN_Y)
        return { x: s.x, y: s.y + HALF_H }
      }),
    ]

    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 16
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash(DOT_PATTERN)
    ctx.lineDashOffset = dashOffset

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y)
    }
    ctx.stroke()

    // Arrowhead
    const last = pts[pts.length - 1]
    const prev = pts[pts.length - 2]
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x)
    const arrowLen = 36
    const arrowSpread = Math.PI / 5
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(last.x - arrowLen * Math.cos(angle - arrowSpread), last.y - arrowLen * Math.sin(angle - arrowSpread))
    ctx.lineTo(last.x - arrowLen * Math.cos(angle + arrowSpread), last.y - arrowLen * Math.sin(angle + arrowSpread))
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

// -- Selection highlight (diamond outline) --
function renderSelection(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  sel: SelectedObject,
): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2.5
  ctx.shadowColor = 'rgba(255,255,255,0.5)'
  ctx.shadowBlur = 6

  if (sel.kind === 'character') {
    const ch = world.characters.get(sel.id)
    if (ch) {
      const gc = ch.x / TILE_SIZE
      const gr = ch.y / TILE_SIZE
      const { x, y } = isoToScreen(gc, gr, ISO_ORIGIN_X, ISO_ORIGIN_Y)
      drawIsoDiamond(ctx, x, y)
      ctx.stroke()
    }
  } else if (sel.kind === 'decoration') {
    const deco = world.decorations[sel.index]
    if (deco) {
      const size = OUTDOOR_DECO_TILE_SIZE[deco.kind as keyof typeof OUTDOOR_DECO_TILE_SIZE] ?? [1, 1]
      const cc = deco.col + size[0] / 2
      const cr = deco.row + size[1] / 2
      const { x, y } = isoToScreen(cc, cr, ISO_ORIGIN_X, ISO_ORIGIN_Y)
      drawIsoDiamond(ctx, x, y - (size[1] - 1) * HALF_H, size[0] * ISO_TILE_W, size[1] * ISO_TILE_H)
      ctx.stroke()
    }
  } else if (sel.kind === 'greenhouse') {
    const ghKinds = ['greenhouse1', 'greenhouse2', 'greenhouse3']
    const deco = world.decorations.find(d => d.kind === ghKinds[sel.index])
    if (deco) {
      const size = OUTDOOR_DECO_TILE_SIZE[deco.kind as keyof typeof OUTDOOR_DECO_TILE_SIZE] ?? [4, 3]
      const cc = deco.col + size[0] / 2
      const cr = deco.row + size[1] / 2
      const { x, y } = isoToScreen(cc, cr, ISO_ORIGIN_X, ISO_ORIGIN_Y)
      drawIsoDiamond(ctx, x, y - (size[1] - 1) * HALF_H, size[0] * ISO_TILE_W, size[1] * ISO_TILE_H)
      ctx.stroke()
    }
  } else if (sel.kind === 'weatherStation') {
    const deco = world.decorations.find(d => d.kind === 'weatherStation')
    if (deco) {
      const size = OUTDOOR_DECO_TILE_SIZE.weatherStation ?? [2, 2]
      const cc = deco.col + size[0] / 2
      const cr = deco.row + size[1] / 2
      const { x, y } = isoToScreen(cc, cr, ISO_ORIGIN_X, ISO_ORIGIN_Y)
      drawIsoDiamond(ctx, x, y - (size[1] - 1) * HALF_H, size[0] * ISO_TILE_W, size[1] * ISO_TILE_H)
      ctx.stroke()
    }
  } else if (sel.kind === 'cabin') {
    const deco = world.decorations.find(d => d.kind === 'cabin')
    if (deco) {
      const size = OUTDOOR_DECO_TILE_SIZE.cabin ?? [3, 3]
      const cc = deco.col + size[0] / 2
      const cr = deco.row + size[1] / 2
      const { x, y } = isoToScreen(cc, cr, ISO_ORIGIN_X, ISO_ORIGIN_Y)
      drawIsoDiamond(ctx, x, y - (size[1] - 1) * HALF_H, size[0] * ISO_TILE_W, size[1] * ISO_TILE_H)
      ctx.stroke()
    }
  }

  ctx.restore()
}
