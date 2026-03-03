import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

/** Singleton Socket.IO instance (shared across all hook consumers) */
let socket: Socket | null = null

function getSocket(): Socket {
  if (!socket) {
    // WebSocket only — Fastify doesn't handle Socket.IO polling transport
    socket = io({ transports: ['websocket'] })
  }
  return socket
}

/**
 * Returns a stable Socket.IO client instance.
 * The connection is created once (singleton) and shared across all components.
 */
export function useSocket(): Socket {
  const ref = useRef(getSocket())

  useEffect(() => {
    const s = ref.current
    if (!s.connected) s.connect()
    return () => {
      // Don't disconnect — singleton is shared across components
    }
  }, [])

  return ref.current
}
