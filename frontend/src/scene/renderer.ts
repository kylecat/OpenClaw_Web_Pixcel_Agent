import type { WorldState, DecorationKind } from './types'
import type { Sprites } from './spriteLoader'
import { TILE_SIZE, SCENE_PAD_L, SCENE_PAD_T } from './characters'
import { CHAR_FRAME_W, CHAR_FRAME_H, DIR_ROW, WALK_FRAMES, IDLE_FRAME } from './spriteLoader'

// Pixel offset applied to every draw call so the game grid sits inside the padding border
const OX = SCENE_PAD_L * TILE_SIZE  //  32 px  (0.5 tile left pad)
const OY = SCENE_PAD_T * TILE_SIZE  //  96 px  (1.5 tile top pad)

// Draw size [tilesW, tilesH] for high-res decoration images.
// Pixel-art decorations (no entry here) fall back to naturalWidth/16.
const DECO_TILE_SIZE: Partial<Record<DecorationKind, [number, number]>> = {
  fridge:         [1,   2  ],
  squareTable:    [2,   2  ],
  clock:          [1,   1  ],
  shelf1:         [4,   2  ],
  shelf2:         [4,   2  ],
  pcDesk:         [2,   1.5],
  sofa1:          [1,   2  ],
  sofa2:          [1,   2  ],
  sofa3:          [2,   2  ],
  pot1:           [1,   2  ],
  pot2:           [1,   2  ],
  vendingMachine: [2,   2.5],
  waterDispenser: [1,   2  ],
}

// Character sprite drawn at 4× pixel scale → 64×128 CSS px (matches 4× tile scale)
const CHAR_SCALE = 4
const CHAR_DW = CHAR_FRAME_W * CHAR_SCALE  // 64
const CHAR_DH = CHAR_FRAME_H * CHAR_SCALE  // 128

// Fallback tile colours (when sprites not yet loaded)
const TILE_COLORS: Record<string, string> = {
  FLOOR:     '#2a2a3e',
  BOARD:     '#1a3a5c',
  DASHBOARD: '#1a4a2a',
}

const FALLBACK_TILE_LABELS: Record<string, [string, string]> = {
  BOARD:     ['📋', '布告欄'],
  DASHBOARD: ['📊', 'Dashboard'],
}

// Tile an image across a rectangle (repeating pattern fill)
function tileImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number,
  w: number, h: number,
): void {
  if (w <= 0 || h <= 0) return
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Draw tiling manually so we don't need createPattern (avoids CORS issues with blobs)
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  for (let ty = y; ty < y + h; ty += ih) {
    const rh = Math.min(ih, y + h - ty)
    for (let tx = x; tx < x + w; tx += iw) {
      const rw = Math.min(iw, x + w - tx)
      ctx.drawImage(img, 0, 0, rw, rh, tx, ty, rw, rh)
    }
  }
  ctx.restore()
}

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  world: WorldState,
  sprites: Sprites | null,
): void {
  // Clear entire canvas to transparent (padding areas stay see-through)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const dpr = window.devicePixelRatio || 1
  ctx.save()
  ctx.scale(dpr, dpr)

  const totalW = canvas.width  / dpr
  const totalH = canvas.height / dpr
  const sceneW = world.cols * TILE_SIZE
  const sceneH = world.rows * TILE_SIZE

  // ── Wall textures in padding areas ───────────────────────────────────────
  if (sprites?.wallTop || sprites?.wallSide) {
    // Top wall spans full canvas width, height = OY
    if (sprites.wallTop) {
      tileImage(ctx, sprites.wallTop, 0, 0, totalW, OY)
    }
    // Left side wall: from OY down to OY+sceneH, width = OX
    if (sprites.wallSide) {
      tileImage(ctx, sprites.wallSide, 0, OY, OX, sceneH)
      // Right side wall
      tileImage(ctx, sprites.wallSide, OX + sceneW, OY, totalW - OX - sceneW, sceneH)
    }
    // Bottom wall: below scene, full width
    if (sprites.wallTop) {
      tileImage(ctx, sprites.wallTop, 0, OY + sceneH, totalW, totalH - OY - sceneH)
    }
  }

  // ── Clock on top wall (centered horizontally, in OY area) ────────────────
  if (sprites?.clock) {
    const cw = 1 * TILE_SIZE
    const ch = 1 * TILE_SIZE
    const cx = (totalW - cw) / 2
    const cy = (OY - ch) / 2   // vertically centered in top padding
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(sprites.clock, cx, cy, cw, ch)
    ctx.imageSmoothingEnabled = false
  }

  // Fill only the game-grid area with the scene background
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(OX, OY, sceneW, sceneH)

  // Keep pixel art crisp
  ctx.imageSmoothingEnabled = false

  // ── Tiles ────────────────────────────────────────────────────────────────
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const tile = world.grid[row][col]
      const x = col * TILE_SIZE + OX
      const y = row * TILE_SIZE + OY

      if (sprites) {
        // Always draw floor — BOARD/DASHBOARD large images are drawn in a separate
        // post-tile pass so they don't get covered by subsequent floor tiles
        ctx.drawImage(sprites.floorTile, x, y, TILE_SIZE, TILE_SIZE)
      } else {
        // Fallback: solid colour + grid line
        ctx.fillStyle = TILE_COLORS[tile.kind] ?? TILE_COLORS.FLOOR
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)

        const entry = FALLBACK_TILE_LABELS[tile.kind]
        if (entry) {
          const [icon, label] = entry
          ctx.font = `${TILE_SIZE * 0.45}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(icon, x + TILE_SIZE / 2, y + TILE_SIZE / 2 - 6)
          ctx.font = 'bold 9px monospace'
          ctx.fillStyle = 'rgba(255,255,255,0.7)'
          ctx.fillText(label, x + TILE_SIZE / 2, y + TILE_SIZE - 7)
        }
      }
    }
  }

  // ── Wall-mounted large tiles (drawn after all floor tiles) ───────────────
  // Drawn AFTER the tile loop so floor tiles cannot cover them.
  // Both hang 1 tile up into the wall padding for a wall-mounted appearance.
  // Layout: bulletin board (5 tiles) | 1-tile gap | dashboard (5 tiles)
  if (sprites) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const boardY = OY - TILE_SIZE
    // Bulletin board: 5×3, left-anchored
    ctx.drawImage(
      sprites.bulletinBoard,
      OX,
      boardY,
      5 * TILE_SIZE,
      3 * TILE_SIZE,
    )
    // Dashboard: 5×3, starts 1-tile gap after the bulletin board (col 6)
    ctx.drawImage(
      sprites.dashboardPanel,
      OX + 6 * TILE_SIZE,
      boardY,
      5 * TILE_SIZE,
      3 * TILE_SIZE,
    )
    ctx.imageSmoothingEnabled = false
  }

  // ── Decorations ──────────────────────────────────────────────────────────
  if (sprites) {
    const decoMap: Partial<Record<DecorationKind, HTMLImageElement>> = {
      desk:           sprites.desk,
      plant:          sprites.plant,
      bookshelf:      sprites.bookshelf,
      chair:          sprites.chair,
      fridge:         sprites.fridge,
      squareTable:    sprites.squareTable,
      clock:          sprites.clock,
      shelf1:         sprites.shelf1,
      shelf2:         sprites.shelf2,
      pcDesk:         sprites.pcDesk,
      sofa1:          sprites.sofa1,
      sofa2:          sprites.sofa2,
      sofa3:          sprites.sofa3,
      pot1:           sprites.pot1,
      pot2:           sprites.pot2,
      vendingMachine: sprites.vendingMachine,
      waterDispenser: sprites.waterDispenser,
    }
    for (const deco of world.decorations) {
      const img = decoMap[deco.kind]
      if (!img) continue
      const tileSz = DECO_TILE_SIZE[deco.kind]
      let dw: number, dh: number
      if (tileSz) {
        // high-res image: scale to explicit tile dimensions, enable smoothing
        dw = tileSz[0] * TILE_SIZE
        dh = tileSz[1] * TILE_SIZE
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
      } else {
        // pixel-art image: derive from natural size (16 source px = 1 tile)
        dw = (img.naturalWidth  / 16) * TILE_SIZE
        dh = (img.naturalHeight / 16) * TILE_SIZE
        ctx.imageSmoothingEnabled = false
      }
      ctx.drawImage(img, deco.col * TILE_SIZE + OX, deco.row * TILE_SIZE + OY, dw, dh)
    }
    // restore pixel-art mode for characters
    ctx.imageSmoothingEnabled = false
  }

  // ── Characters ───────────────────────────────────────────────────────────
  for (const ch of world.characters.values()) {
    const cx = Math.round(ch.x) + OX
    const cy = Math.round(ch.y) + OY

    // feet rest on lower half of tile; sprite extends upward
    const dy = cy + TILE_SIZE / 2 - CHAR_DH
    const dx = cx - CHAR_DW / 2

    // Shadow ellipse under feet
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(cx, cy + TILE_SIZE / 2 - 4, 12, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    if (sprites) {
      const sheet     = ch.id === 'astraea' ? sprites.astraea : sprites.gaia
      const dirRow    = DIR_ROW[ch.dir] ?? 0
      const frameCol  = ch.state === 'WALK' ? WALK_FRAMES[ch.frame % 4] : IDLE_FRAME
      const sx = frameCol * CHAR_FRAME_W
      const sy = dirRow   * CHAR_FRAME_H

      if (ch.dir === 'LEFT') {
        // Mirror the RIGHT-facing sprite horizontally around cx
        ctx.save()
        ctx.translate(cx, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(sheet.img, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H,
          -CHAR_DW / 2, dy, CHAR_DW, CHAR_DH)
        ctx.restore()
      } else {
        ctx.drawImage(sheet.img, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H,
          dx, dy, CHAR_DW, CHAR_DH)
      }

      // Status emoji bubble (top-right of sprite) — 26 px with white circle backing
      const bubbleR = 16
      const bx = cx + CHAR_DW / 2
      const by = dy + bubbleR + 2
      ctx.beginPath()
      ctx.arc(bx, by, bubbleR, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.font = '26px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ch.statusEmoji, bx, by + 1)

      // Name label below feet  [ NAME ]
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText(`[ ${ch.displayName.toUpperCase()} ]`, cx, dy + CHAR_DH + 2)
    } else {
      // Emoji fallback
      const bounce = ch.state === 'WALK'
        ? Math.sin(ch.frameTimer * Math.PI / 0.12) * 2
        : 0
      ctx.font = `${TILE_SIZE * 0.55}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(ch.emoji, cx, cy + 14 + bounce)

      ctx.font = '14px sans-serif'
      ctx.textBaseline = 'bottom'
      ctx.fillText(ch.statusEmoji, cx + 18, cy - 4 + bounce)

      ctx.font = 'bold 10px monospace'
      ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.textAlign = 'center'
      ctx.fillText(`[ ${ch.displayName.toUpperCase()} ]`, cx, cy + 20)
    }
  }

  ctx.restore()
}
