import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react'
import { startGameLoop } from '../scene/core/gameLoop'
import { updateCharacter, walkToTarget, TILE_SIZE } from '../scene/core/characters'
import { cssToLogical } from '../scene/core/collision'
import type { SceneConfig, WorldState, SelectedObject } from '../scene/core/sceneTypes'

export type WalkTarget = 'board' | 'dashboard' | 'home'

export interface SceneCanvasHandle {
  walkAgent: (agentId: string, target: WalkTarget) => void
  setStatusEmoji: (agentId: string, emoji: string) => void
  walkToTile: (agentId: string, col: number, row: number) => void
}

export interface SceneCanvasProps {
  config: SceneConfig
  onSelect?: (obj: SelectedObject | null) => void
  /** Called when a character is walked to a tile via canvas click (for WebSocket sync) */
  onWalk?: (agentId: string, col: number, row: number) => void
  /** If set, only these agent IDs are rendered (others hidden from WorldState) */
  visibleAgents?: Set<string>
}

// Canvas is displayed at this fraction of its logical size
const CSS_SCALE = 0.64

export const SceneCanvas = forwardRef<SceneCanvasHandle, SceneCanvasProps>(({ config, onSelect, onWalk, visibleAgents }, ref) => {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const worldRef       = useRef<WorldState>(null as unknown as WorldState)
  if (worldRef.current === null) {
    const w = config.createWorldState()
    if (visibleAgents) {
      for (const id of [...w.characters.keys()]) {
        if (!visibleAgents.has(id)) w.characters.delete(id)
      }
    }
    worldRef.current = w
  }
  const spritesRef     = useRef<unknown>(null)
  const selectedRef    = useRef<SelectedObject | null>(null)
  const pendingTileRef = useRef<{ col: number; row: number } | null>(null)
  const onSelectRef    = useRef(onSelect)
  onSelectRef.current  = onSelect
  const onWalkRef      = useRef(onWalk)
  onWalkRef.current    = onWalk

  const CANVAS_W = config.canvasWidth ?? (config.cols + config.padding.left + config.padding.right) * config.tileSize
  const CANVAS_H = config.canvasHeight ?? (config.rows + config.padding.top + config.padding.bottom) * config.tileSize

  const walkAgent = useCallback((agentId: string, target: WalkTarget) => {
    const ch = worldRef.current.characters.get(agentId)
    if (!ch) return
    let col: number, row: number
    const wt = config.walkTargets[target]
    if (wt) {
      col = wt.col; row = wt.row
    } else {
      // fallback: 'home'
      col = ch.homeCol; row = ch.homeRow
    }
    walkToTarget(ch, col, row, worldRef.current.grid, worldRef.current.blockedTiles)
  }, [config])

  const setStatusEmoji = useCallback((agentId: string, emoji: string) => {
    const ch = worldRef.current.characters.get(agentId)
    if (ch) ch.statusEmoji = emoji
  }, [])

  const walkToTile = useCallback((agentId: string, col: number, row: number) => {
    const ch = worldRef.current.characters.get(agentId)
    if (!ch) return
    const clampedCol = Math.max(0, Math.min(config.cols - 1, col))
    const clampedRow = Math.max(0, Math.min(config.rows - 1, row))
    walkToTarget(ch, clampedCol, clampedRow, worldRef.current.grid, worldRef.current.blockedTiles)
  }, [config])

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
    config.loadSprites()
      .then((s) => { spritesRef.current = s })
      .catch(console.warn)

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        for (const ch of worldRef.current.characters.values()) {
          updateCharacter(ch, dt)
        }
      },
      render: (ctx, cvs) => config.render(ctx, cvs, worldRef.current, spritesRef.current, selectedRef.current, pendingTileRef.current),
    })

    // -- Mouse interaction --
    const OX = config.padding.left * config.tileSize
    const OY = config.padding.top * config.tileSize

    /** Convert logical pixel coords to grid (col, row), or null if outside grid */
    const toGridTile = (lx: number, ly: number): { col: number; row: number } | null => {
      if (config.screenToGrid) {
        return config.screenToGrid(lx, ly, config.cols, config.rows)
      }
      const col = Math.floor((lx - OX) / TILE_SIZE)
      const row = Math.floor((ly - OY) / TILE_SIZE)
      if (col < 0 || col >= config.cols || row < 0 || row >= config.rows) return null
      return { col, row }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const cssX = e.clientX - rect.left
      const cssY = e.clientY - rect.top
      const { x, y } = cssToLogical(cssX, cssY, rect.width, rect.height, CANVAS_W, CANVAS_H)
      const hit = config.hitTest(x, y, worldRef.current)

      if (hit) {
        canvas.style.cursor = 'pointer'
      } else if (selectedRef.current?.kind === 'character' && toGridTile(x, y)) {
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
      const hit = config.hitTest(x, y, worldRef.current)

      // Character selected + clicking empty floor -> two-step confirm
      if (!hit && selectedRef.current?.kind === 'character') {
        const tile = toGridTile(x, y)
        if (tile) {
          const pending = pendingTileRef.current
          if (pending && pending.col === tile.col && pending.row === tile.row) {
            // Second click on the same tile -> confirm, walk there
            const agentId = selectedRef.current.id
            const ch = worldRef.current.characters.get(agentId)
            if (ch) {
              walkToTarget(ch, tile.col, tile.row, worldRef.current.grid, worldRef.current.blockedTiles)
              onWalkRef.current?.(agentId, tile.col, tile.row)
            }
            pendingTileRef.current = null
          } else {
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
  }, [config, CANVAS_W, CANVAS_H])

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

SceneCanvas.displayName = 'SceneCanvas'
