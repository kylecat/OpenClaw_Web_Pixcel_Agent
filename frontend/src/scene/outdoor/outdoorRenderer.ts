import type { WorldState, SelectedObject, OutdoorTileKind } from '../core/sceneTypes'
import type { OutdoorSprites } from './outdoorSprites'
import {
  ISO_CHAR_FRAME_W, ISO_CHAR_FRAME_H,
  ISO_DIR_ROW, GRID_TO_ISO_DIR,
  ISO_WALK_FRAMES, ISO_IDLE_FRAME,
} from './outdoorSprites'
import { TILE_SIZE, tileCenter } from '../core/characters'
import { ISO_TILE_W, ISO_TILE_H, isoToScreen, isoDepthSort, drawIsoDiamond } from './isoMath'
import { OUTDOOR_COLS, OUTDOOR_ROWS, OUTDOOR_DECO_TILE_SIZE } from './outdoorWorldState'

// 8-direction character sprite: 4× scale from 32×24 source → 128×96 drawn
const ISO_CHAR_SCALE = 4
const ISO_CHAR_DW = ISO_CHAR_FRAME_W * ISO_CHAR_SCALE  // 128
const ISO_CHAR_DH = ISO_CHAR_FRAME_H * ISO_CHAR_SCALE  // 96

// Canvas logical dimensions — isometric grid needs more width than height.
// Origin is placed so that tile (0,0) top-center starts at (originX, originY).
// The grid spans roughly:
//   x: from -(ROWS-1)*halfW to +(COLS-1)*halfW
//   y: from 0 to (COLS+ROWS-2)*halfH
const HALF_W = ISO_TILE_W / 2
const HALF_H = ISO_TILE_H / 2
// Compute origin so the entire grid fits with padding
const GRID_MIN_X = -(OUTDOOR_ROWS - 1) * HALF_W
const GRID_MAX_X = (OUTDOOR_COLS - 1) * HALF_W
const GRID_MAX_Y = (OUTDOOR_COLS + OUTDOOR_ROWS - 2) * HALF_H + ISO_TILE_H

const PAD = 48  // px padding around the grid
// Full logical size (used internally for coordinate math)
const LOGICAL_W = (GRID_MAX_X - GRID_MIN_X) + ISO_TILE_W + PAD * 2
const LOGICAL_H = GRID_MAX_Y + PAD * 2
// Exported canvas size is halved to keep display manageable
export const ISO_CANVAS_W = LOGICAL_W / 2
export const ISO_CANVAS_H = LOGICAL_H / 2

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

  const scaleX = canvas.width / LOGICAL_W
  const scaleY = canvas.height / LOGICAL_H
  ctx.save()
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)

  // Transparent background (no fill — let page background show through)

  // -- Ground pass: draw tiles back-to-front (row by row, col by col) --
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const tile = world.grid[row][col]
      const { x: sx, y: sy } = isoToScreen(col, row, ISO_ORIGIN_X, ISO_ORIGIN_Y)

      if (sprites) {
        const tileImg = sprites.tiles[tile.kind as OutdoorTileKind]
        if (tileImg) {
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(tileImg, sx - HALF_W, sy, ISO_TILE_W, ISO_TILE_H)
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

  // -- Compass labels at grid corners --
  renderCompass(ctx, world)

  ctx.restore()
}

// -- Decoration rendering --
// In isometric 2:1, a footprint of [cols, rows] tiles forms a diamond:
//   screen width  = (cols + rows) * HALF_W
//   screen height = (cols + rows) * HALF_H
// The 4 corners of the diamond in screen space:
//   top    = isoToScreen(col, row)
//   right  = isoToScreen(col + cols, row)
//   bottom = isoToScreen(col + cols, row + rows)
//   left   = isoToScreen(col, row + rows)
function renderDecoration(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  sprites: OutdoorSprites | null,
  index: number,
): void {
  const deco = world.decorations[index]
  if (!deco) return
  const size = OUTDOOR_DECO_TILE_SIZE[deco.kind as keyof typeof OUTDOOR_DECO_TILE_SIZE] ?? [1, 1]
  const [cols, rows] = size

  // Isometric diamond screen extents
  const diamondW = (cols + rows) * HALF_W
  // Bottom vertex of the footprint diamond
  const bottom = isoToScreen(deco.col + cols, deco.row + rows, ISO_ORIGIN_X, ISO_ORIGIN_Y)
  const bottomY = bottom.y  // bottom vertex of the footprint diamond
  // Center X of the diamond
  const centerCol = deco.col + cols / 2
  const centerRow = deco.row + rows / 2
  const { x: cx } = isoToScreen(centerCol, centerRow, ISO_ORIGIN_X, ISO_ORIGIN_Y)

  const img = sprites?.decorations[deco.kind as keyof typeof sprites.decorations]
  if (img) {
    // Scale the image to fit the isometric diamond width, preserving aspect ratio.
    // Anchor at bottom-center of the footprint diamond.
    const naturalW = (img as HTMLImageElement).naturalWidth ?? img.width
    const naturalH = (img as HTMLImageElement).naturalHeight ?? img.height
    const scale = diamondW / naturalW
    const dw = diamondW
    const dh = naturalH * scale
    const drawX = cx - dw / 2
    const drawY = bottomY - dh
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, drawX, drawY, dw, dh)
  } else {
    // Fallback: colored diamond
    const { x: sx, y: sy } = isoToScreen(centerCol, centerRow, ISO_ORIGIN_X, ISO_ORIGIN_Y)
    const diamondH = (cols + rows) * HALF_H
    ctx.fillStyle = 'rgba(100,100,100,0.5)'
    drawIsoDiamond(ctx, sx, sy, diamondW, diamondH)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(deco.kind, sx, sy + HALF_H)
  }
}

// -- Character rendering (8-direction sprite sheets) --
function renderCharacter(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  sprites: OutdoorSprites | null,
  charId: string,
): void {
  const ch = world.characters.get(charId)
  if (!ch) return

  // Convert character grid position to isometric screen coords
  const gridCol = ch.x / TILE_SIZE
  const gridRow = ch.y / TILE_SIZE
  const { x: sx, y: sy } = isoToScreen(gridCol, gridRow, ISO_ORIGIN_X, ISO_ORIGIN_Y)

  // Character anchor: feet at tile center, sprite extends upward
  const footY = sy + HALF_H

  // Shadow ellipse
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(sx, footY - 2, 14, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // 8-direction sprite sheet rendering
  const sheet = sprites?.characters[charId]
  if (sheet) {
    const isoDir = GRID_TO_ISO_DIR[ch.dir] ?? 'S'
    const dirRow = ISO_DIR_ROW[isoDir] ?? 0
    const frame = ch.state === 'WALK' ? (ch.frame % ISO_WALK_FRAMES) : ISO_IDLE_FRAME

    const srcX = frame * ISO_CHAR_FRAME_W
    const srcY = dirRow * ISO_CHAR_FRAME_H

    const drawX = sx - ISO_CHAR_DW / 2
    const drawY = footY - ISO_CHAR_DH

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      sheet,
      srcX, srcY, ISO_CHAR_FRAME_W, ISO_CHAR_FRAME_H,
      drawX, drawY, ISO_CHAR_DW, ISO_CHAR_DH,
    )
  } else {
    // Emoji fallback
    const bounce = ch.state === 'WALK'
      ? Math.sin(ch.frameTimer * Math.PI / 0.12) * 2
      : 0
    ctx.font = `${TILE_SIZE * 0.5}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(ch.emoji, sx, footY - 4 + bounce)
  }

  // Status emoji bubble (top-right of character)
  const bubbleR = 14
  const bx = sx + 20
  const by = footY - ISO_CHAR_DH + bubbleR + 8
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

// Helper: draw an isometric selection diamond for a decoration footprint
// Uses the actual 4 vertices of the footprint (asymmetric when cols ≠ rows)
function strokeDecoFootprint(ctx: CanvasRenderingContext2D, col: number, row: number, cols: number, rows: number): void {
  const top    = isoToScreen(col,        row,        ISO_ORIGIN_X, ISO_ORIGIN_Y)
  const right  = isoToScreen(col + cols, row,        ISO_ORIGIN_X, ISO_ORIGIN_Y)
  const bottom = isoToScreen(col + cols, row + rows, ISO_ORIGIN_X, ISO_ORIGIN_Y)
  const left   = isoToScreen(col,        row + rows, ISO_ORIGIN_X, ISO_ORIGIN_Y)
  ctx.beginPath()
  ctx.moveTo(top.x, top.y)
  ctx.lineTo(right.x, right.y)
  ctx.lineTo(bottom.x, bottom.y)
  ctx.lineTo(left.x, left.y)
  ctx.closePath()
  ctx.stroke()
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
  } else {
    // Find the decoration for any selection type
    let deco: typeof world.decorations[number] | undefined
    if (sel.kind === 'decoration') {
      deco = world.decorations[sel.index]
    } else if (sel.kind === 'greenhouse') {
      const ghKinds = ['greenhouse1', 'greenhouse2', 'greenhouse3']
      deco = world.decorations.find(d => d.kind === ghKinds[sel.index])
    } else if (sel.kind === 'weatherStation') {
      deco = world.decorations.find(d => d.kind === 'weatherStation')
    } else if (sel.kind === 'cabin') {
      deco = world.decorations.find(d => d.kind === 'cabin')
    }
    if (deco) {
      const size = OUTDOOR_DECO_TILE_SIZE[deco.kind as keyof typeof OUTDOOR_DECO_TILE_SIZE] ?? [1, 1]
      strokeDecoFootprint(ctx, deco.col, deco.row, size[0], size[1])
    }
  }

  ctx.restore()
}

// -- Compass direction labels at grid edge midpoints --
// N/S = row axis, E/W = column axis
function renderCompass(ctx: CanvasRenderingContext2D, world: WorldState): void {
  const maxCol = world.cols - 1
  const maxRow = world.rows - 1

  // 4 vertices of the isometric diamond
  const vtxTop    = isoToScreen(0, 0, ISO_ORIGIN_X, ISO_ORIGIN_Y)             // NW corner
  const vtxRight  = isoToScreen(maxCol, 0, ISO_ORIGIN_X, ISO_ORIGIN_Y)        // NE corner
  const vtxBottom = isoToScreen(maxCol, maxRow, ISO_ORIGIN_X, ISO_ORIGIN_Y)    // SE corner
  const vtxLeft   = isoToScreen(0, maxRow, ISO_ORIGIN_X, ISO_ORIGIN_Y)        // SW corner

  // Edge midpoints — labels go here
  const midN = { x: (vtxTop.x + vtxRight.x) / 2,   y: (vtxTop.y + vtxRight.y) / 2 }    // top-right edge
  const midS = { x: (vtxLeft.x + vtxBottom.x) / 2,  y: (vtxLeft.y + vtxBottom.y) / 2 }  // bottom-left edge
  const midE = { x: (vtxRight.x + vtxBottom.x) / 2, y: (vtxRight.y + vtxBottom.y) / 2 } // bottom-right edge
  const midW = { x: (vtxTop.x + vtxLeft.x) / 2,     y: (vtxTop.y + vtxLeft.y) / 2 }    // top-left edge

  // Offset outward from edge (further out to the margins)
  const OFF = 130
  ctx.save()
  ctx.font = 'bold 75px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'

  ctx.fillText('N/-Row', midN.x + OFF, midN.y - OFF)
  ctx.fillText('S/+Row', midS.x - OFF, midS.y + OFF)
  ctx.fillText('E/+Col', midE.x + OFF, midE.y + OFF)
  ctx.fillText('W/-Col', midW.x - OFF, midW.y - OFF)
  ctx.restore()
}
