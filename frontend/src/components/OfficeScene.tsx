import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react'
import { startGameLoop } from '../scene/gameLoop'
import { updateCharacter, walkToTarget, TILE_SIZE, SCENE_PAD_L, SCENE_PAD_R, SCENE_PAD_T, SCENE_PAD_B } from '../scene/characters'
import { render } from '../scene/renderer'
import { loadSprites } from '../scene/spriteLoader'
import type { Sprites } from '../scene/spriteLoader'
import {
  createWorldState,
  BOARD_WALK_COL,
  BOARD_WALK_ROW,
  DASH_WALK_COL,
  DASH_WALK_ROW,
  COLS,
  ROWS,
  DECO_TILE_SIZE,
} from '../scene/worldState'
import type { WorldState, SelectedObject } from '../scene/types'
import { hitTest, cssToLogical } from '../scene/collision'

export type WalkTarget = 'board' | 'dashboard' | 'home'

export interface OfficeSceneHandle {
  walkAgent: (agentId: string, target: WalkTarget) => void
  setStatusEmoji: (agentId: string, emoji: string) => void
  walkToTile: (agentId: string, col: number, row: number) => void
}

export interface OfficeSceneProps {
  onSelect?: (obj: SelectedObject | null) => void
  /** Called when a character is walked to a tile via canvas click (for WebSocket sync) */
  onWalk?: (agentId: string, col: number, row: number) => void
}

// Canvas includes transparent padding so characters near the edges aren't clipped
const CANVAS_W = (COLS + SCENE_PAD_L + SCENE_PAD_R) * TILE_SIZE  // 33 tiles wide
const CANVAS_H = (ROWS + SCENE_PAD_T + SCENE_PAD_B) * TILE_SIZE  // 14 tiles tall

// Canvas is displayed at this fraction of its logical size
const CSS_SCALE = 0.64

export const OfficeScene = forwardRef<OfficeSceneHandle, OfficeSceneProps>(({ onSelect, onWalk }, ref) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const worldRef     = useRef<WorldState>(createWorldState())
  const spritesRef   = useRef<Sprites | null>(null)
  const selectedRef    = useRef<SelectedObject | null>(null)
  const pendingTileRef = useRef<{ col: number; row: number } | null>(null)
  const onSelectRef    = useRef(onSelect)
  onSelectRef.current  = onSelect
  const onWalkRef      = useRef(onWalk)
  onWalkRef.current    = onWalk

  const walkAgent = useCallback((agentId: string, target: WalkTarget) => {
    const ch = worldRef.current.characters.get(agentId)
    if (!ch) return
    let col: number, row: number
    if (target === 'board') {
      col = BOARD_WALK_COL; row = BOARD_WALK_ROW
    } else if (target === 'dashboard') {
      col = DASH_WALK_COL; row = DASH_WALK_ROW
    } else {
      col = ch.homeCol; row = ch.homeRow
    }
    walkToTarget(ch, col, row, worldRef.current.grid, worldRef.current.blockedTiles)
  }, [])

  const setStatusEmoji = useCallback((agentId: string, emoji: string) => {
    const ch = worldRef.current.characters.get(agentId)
    if (ch) ch.statusEmoji = emoji
  }, [])

  const walkToTile = useCallback((agentId: string, col: number, row: number) => {
    const ch = worldRef.current.characters.get(agentId)
    if (!ch) return
    const clampedCol = Math.max(0, Math.min(COLS - 1, col))
    const clampedRow = Math.max(0, Math.min(ROWS - 1, row))
    walkToTarget(ch, clampedCol, clampedRow, worldRef.current.grid, worldRef.current.blockedTiles)
  }, [])

  useImperativeHandle(ref, () => ({ walkAgent, setStatusEmoji, walkToTile }), [
    walkAgent,
    setStatusEmoji,
    walkToTile,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr

    // Start loading sprites (game loop renders with null until they arrive)
    loadSprites()
      .then((s) => { spritesRef.current = s })
      .catch(console.warn)

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        for (const ch of worldRef.current.characters.values()) {
          updateCharacter(ch, dt)
        }
      },
      render: (ctx, cvs) => render(ctx, cvs, worldRef.current, spritesRef.current, selectedRef.current, pendingTileRef.current),
    })

    // ── Mouse interaction ────────────────────────────────────────────────────
    // Mouse coords from the browser are in CSS px; convert to logical px
    // using the actual bounding-rect size (robust against DPR / rounding).
    const OX = SCENE_PAD_L * TILE_SIZE
    const OY = SCENE_PAD_T * TILE_SIZE

    /** Convert logical pixel coords to grid (col, row), or null if outside grid */
    const toGridTile = (lx: number, ly: number): { col: number; row: number } | null => {
      const col = Math.floor((lx - OX) / TILE_SIZE)
      const row = Math.floor((ly - OY) / TILE_SIZE)
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null
      return { col, row }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const cssX = e.clientX - rect.left
      const cssY = e.clientY - rect.top
      const { x, y } = cssToLogical(cssX, cssY, rect.width, rect.height, CANVAS_W, CANVAS_H)
      const hit = hitTest(x, y, worldRef.current, DECO_TILE_SIZE)

      if (hit) {
        canvas.style.cursor = 'pointer'
      } else if (selectedRef.current?.kind === 'character' && toGridTile(x, y)) {
        // Character selected + hovering over a valid floor tile → move cursor
        canvas.style.cursor = 'crosshair'
      } else {
        canvas.style.cursor = 'default'
      }
    }

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const cssX = e.clientX - rect.left
      const cssY = e.clientY - rect.top
      const { x, y } = cssToLogical(cssX, cssY, rect.width, rect.height, CANVAS_W, CANVAS_H)
      const hit = hitTest(x, y, worldRef.current, DECO_TILE_SIZE)

      // Character selected + clicking empty floor → two-step confirm
      if (!hit && selectedRef.current?.kind === 'character') {
        const tile = toGridTile(x, y)
        if (tile) {
          const pending = pendingTileRef.current
          if (pending && pending.col === tile.col && pending.row === tile.row) {
            // Second click on the same tile → confirm, walk there
            const agentId = selectedRef.current.id
            const ch = worldRef.current.characters.get(agentId)
            if (ch) {
              walkToTarget(ch, tile.col, tile.row, worldRef.current.grid, worldRef.current.blockedTiles)
              // Broadcast to other clients via WebSocket
              onWalkRef.current?.(agentId, tile.col, tile.row)
            }
            pendingTileRef.current = null
          } else {
            // First click (or different tile) → set pending target
            pendingTileRef.current = tile
          }
        }
        return
      }

      // Clicking an object clears any pending tile
      pendingTileRef.current = null

      // Toggle deselect if clicking the same object twice
      if (
        hit &&
        selectedRef.current &&
        hit.kind === selectedRef.current.kind &&
        (hit.kind !== 'character' || (hit as { id: string }).id === (selectedRef.current as { id: string }).id) &&
        (hit.kind !== 'decoration' || (hit as { index: number }).index === (selectedRef.current as { index: number }).index)
      ) {
        selectedRef.current = null
      } else {
        selectedRef.current = hit
      }
      onSelectRef.current?.(selectedRef.current)
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('click', handleClick)

    return () => {
      stop()
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('click', handleClick)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width:  CANVAS_W * CSS_SCALE,
        height: CANVAS_H * CSS_SCALE,
        display: 'block',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        imageRendering: 'pixelated',
      }}
    />
  )
})

OfficeScene.displayName = 'OfficeScene'
