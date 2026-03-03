export interface GameLoopCallbacks {
  update: (dt: number) => void
  render: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
}

export function startGameLoop(
  canvas: HTMLCanvasElement,
  callbacks: GameLoopCallbacks,
): () => void {
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  let lastTime = 0
  let rafId = 0
  let stopped = false

  // --- Background-tab fallback ---
  // rAF pauses when a tab is hidden.  We use a setInterval ticker so
  // characters keep walking even when the tab is in the background.
  let bgInterval: ReturnType<typeof setInterval> | null = null
  let bgLastMs = 0

  const startBgTicker = () => {
    if (bgInterval) return
    bgLastMs = performance.now()
    bgInterval = setInterval(() => {
      const now = performance.now()
      const dt = Math.min((now - bgLastMs) / 1000, 0.1)
      bgLastMs = now
      callbacks.update(dt)
    }, 100) // 10 Hz is enough to advance walk paths smoothly
  }

  const stopBgTicker = () => {
    if (bgInterval) { clearInterval(bgInterval); bgInterval = null }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      startBgTicker()
    } else {
      stopBgTicker()
      // Reset lastTime so the first rAF frame doesn't compute a huge dt
      lastTime = 0
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  const frame = (time: number) => {
    if (stopped) return
    const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1)
    lastTime = time
    callbacks.update(dt)
    callbacks.render(ctx, canvas)
    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)
  return () => {
    stopped = true
    cancelAnimationFrame(rafId)
    stopBgTicker()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
