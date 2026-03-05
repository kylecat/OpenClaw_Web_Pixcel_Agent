import { forwardRef } from 'react'
import { SceneCanvas } from './SceneCanvas'
import type { SceneCanvasHandle, SceneCanvasProps, WalkTarget } from './SceneCanvas'
import { indoorConfig } from '../scene/indoor/indoorConfig'
import type { SelectedObject } from '../scene/core/sceneTypes'

// Backwards-compatible types -- re-export from SceneCanvas
export type OfficeSceneHandle = SceneCanvasHandle
export type { WalkTarget }

export interface OfficeSceneProps {
  onSelect?: (obj: SelectedObject | null) => void
  onWalk?: (agentId: string, col: number, row: number) => void
}

/**
 * Thin wrapper: delegates to SceneCanvas with the indoor config.
 * Preserves the original API so App.tsx and other consumers don't need changes.
 */
export const OfficeScene = forwardRef<OfficeSceneHandle, OfficeSceneProps>(
  ({ onSelect, onWalk }, ref) => {
    const props: SceneCanvasProps = {
      config: indoorConfig,
      onSelect,
      onWalk,
    }
    return <SceneCanvas ref={ref} {...props} />
  },
)

OfficeScene.displayName = 'OfficeScene'
