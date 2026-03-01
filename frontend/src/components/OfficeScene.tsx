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
} from '../scene/worldState'
import type { WorldState } from '../scene/types'

export type WalkTarget = 'board' | 'dashboard' | 'home'

export interface OfficeSceneHandle {
  walkAgent: (agentId: string, target: WalkTarget) => void
  setStatusEmoji: (agentId: string, emoji: string) => void
  walkToTile: (agentId: string, col: number, row: number) => void
}

// Canvas includes transparent padding so characters near the edges aren't clipped
const CANVAS_W = (COLS + SCENE_PAD_L + SCENE_PAD_R) * TILE_SIZE  // 33 tiles wide
const CANVAS_H = (ROWS + SCENE_PAD_T + SCENE_PAD_B) * TILE_SIZE  // 14 tiles tall

export const OfficeScene = forwardRef<OfficeSceneHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef   = useRef<WorldState>(createWorldState())
  const spritesRef = useRef<Sprites | null>(null)

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
    walkToTarget(ch, col, row, worldRef.current.grid)
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
    walkToTarget(ch, clampedCol, clampedRow, worldRef.current.grid)
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
      render: (ctx, cvs) => render(ctx, cvs, worldRef.current, spritesRef.current),
    })

    return stop
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width:  CANVAS_W * 0.64,
        height: CANVAS_H * 0.64,
        display: 'block',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        imageRendering: 'pixelated',
      }}
    />
  )
})

OfficeScene.displayName = 'OfficeScene'
