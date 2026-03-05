import { useState, useCallback, useRef } from 'react'

export type SceneId = 'indoor' | 'outdoor'
export type TransitionState = 'idle' | 'fading-out' | 'fading-in'

const FADE_DURATION = 400 // ms

export interface SceneNavigation {
  currentScene: SceneId
  transition: TransitionState
  /** Trigger scene switch with fade transition */
  goTo: (target: SceneId) => void
  /** CSS opacity for the scene wrapper */
  opacity: number
}

export function useSceneNavigation(initial: SceneId = 'indoor'): SceneNavigation {
  const [currentScene, setCurrentScene] = useState<SceneId>(initial)
  const [transition, setTransition] = useState<TransitionState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goTo = useCallback((target: SceneId) => {
    if (target === currentScene || transition !== 'idle') return

    // Phase 1: fade out
    setTransition('fading-out')

    timerRef.current = setTimeout(() => {
      // Phase 2: switch scene + start fade in
      setCurrentScene(target)
      setTransition('fading-in')

      timerRef.current = setTimeout(() => {
        // Phase 3: done
        setTransition('idle')
      }, FADE_DURATION)
    }, FADE_DURATION)
  }, [currentScene, transition])

  const opacity = transition === 'fading-out' ? 0
    : transition === 'fading-in' ? 1
    : 1

  return { currentScene, transition, goTo, opacity }
}
