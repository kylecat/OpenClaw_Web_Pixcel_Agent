import { useCallback, useEffect, useRef, useState } from 'react'
import { AgentCard } from './components/AgentCard'
import { OfficeScene } from './components/OfficeScene'
import { BoardModal } from './components/BoardModal'
import { DashboardModal } from './components/DashboardModal'
import { ShelfModal } from './components/ShelfModal'
import type { Agent, AgentRpgData } from './components/AgentCard'
import type { OfficeSceneHandle, WalkTarget } from './components/OfficeScene'
import type { SelectedObject } from './scene/types'
import { COLS, ROWS } from './scene/worldState'
import { fetchDashboardSummary, type DashboardSummary } from './api/dashboard'
import { useSocket } from './hooks/useSocket'

interface HealthResponse {
  status: string
  version: string
}

const STATUS_WALK_MAP: Record<string, WalkTarget> = {
  THINKING:         'board',
  TALKING:          'board',
  ERROR:            'dashboard',
  CRASHED:          'dashboard',
  NETWORK_UNSTABLE: 'dashboard',
  IDLE:             'home',
  DONE:             'home',
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const sceneRef = useRef<OfficeSceneHandle>(null)
  const socket = useSocket()

  // Board modal
  const [boardOpen, setBoardOpen] = useState(false)
  // Dashboard modal
  const [dashboardOpen, setDashboardOpen] = useState(false)
  // Shelf modal
  const [shelfOpen, setShelfOpen] = useState(false)
  const [shelfId, setShelfId] = useState<'shelf1' | 'shelf2' | 'shelf3'>('shelf1')

  const handleSelect = useCallback((obj: SelectedObject | null) => {
    if (obj?.kind === 'board') {
      setBoardOpen(true)
      socket.emit('modal:toggled', { modal: 'board', open: true })
    }
    if (obj?.kind === 'dashboard') {
      setDashboardOpen(true)
      socket.emit('modal:toggled', { modal: 'dashboard', open: true })
    }
    if (obj?.kind === 'exitDoor') {
      console.log('[select] exit door clicked')
      socket.emit('modal:toggled', { modal: 'exitDoor', open: true })
    }
    if (obj?.kind === 'portal') {
      console.log('[select] portal clicked')
      socket.emit('modal:toggled', { modal: 'portal', open: true })
    }
    if (obj?.kind === 'decoration' && (obj.decoKind === 'shelf1' || obj.decoKind === 'shelf2' || obj.decoKind === 'shelf3')) {
      setShelfId(obj.decoKind as 'shelf1' | 'shelf2' | 'shelf3')
      setShelfOpen(true)
    }
  }, [socket])

  const closeBoardModal = useCallback(() => {
    setBoardOpen(false)
    socket.emit('modal:toggled', { modal: 'board', open: false })
  }, [socket])

  const closeDashboardModal = useCallback(() => {
    setDashboardOpen(false)
    socket.emit('modal:toggled', { modal: 'dashboard', open: false })
  }, [socket])

  // Dashboard summary for RPG card data
  const [dashSummary, setDashSummary] = useState<DashboardSummary | null>(null)

  // Manual walk controls
  const [selectedAgent, setSelectedAgent] = useState<string>('gaia')
  const [targetCol, setTargetCol] = useState<number>(0)
  const [targetRow, setTargetRow] = useState<number>(0)

  // Board change signal (incremented on each board:changed event)
  const [boardVersion, setBoardVersion] = useState(0)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch(() => setHealthError(true))

    fetch('/api/agents')
      .then((res) => res.json() as Promise<Agent[]>)
      .then(setAgents)
      .catch(console.error)

    // Fetch dashboard summary for RPG card token data
    fetchDashboardSummary().then(setDashSummary).catch(console.error)
  }, [])

  // Sync helper: fetch agents from server, walk characters if status differs
  const syncAgentsFromServer = useCallback(() => {
    fetch('/api/agents')
      .then((res) => res.json() as Promise<Agent[]>)
      .then((latest) => {
        setAgents((prev) => {
          for (const agent of latest) {
            const old = prev.find((a) => a.id === agent.id)
            if (old && old.status !== agent.status) {
              const target = STATUS_WALK_MAP[agent.status] ?? 'home'
              sceneRef.current?.walkAgent(agent.id, target)
              sceneRef.current?.setStatusEmoji(agent.id, agent.emoji)
            }
          }
          return latest
        })
      })
      .catch(console.error)
    fetchDashboardSummary().then(setDashSummary).catch(console.error)
  }, [])

  // Periodic sync: re-fetch agents + dashboard every 5s as fallback
  useEffect(() => {
    const timer = setInterval(syncAgentsFromServer, 5_000)
    return () => clearInterval(timer)
  }, [syncAgentsFromServer])

  // Re-sync immediately when tab becomes visible (rAF is paused in background)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncAgentsFromServer()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [syncAgentsFromServer])

  // --- WebSocket listeners ---
  useEffect(() => {
    // Agent status changed → update state + walk character
    const onAgentStatus = (agent: Agent) => {
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? agent : a)))
      const target = STATUS_WALK_MAP[agent.status] ?? 'home'
      sceneRef.current?.walkAgent(agent.id, target)
      sceneRef.current?.setStatusEmoji(agent.id, agent.emoji)
    }

    // Manual walk broadcast from another client
    const onAgentWalk = (data: { agentId: string; col: number; row: number }) => {
      sceneRef.current?.walkToTile(data.agentId, data.col, data.row)
    }

    // Board data changed → signal modals to refresh
    const onBoardChanged = () => {
      setBoardVersion((v) => v + 1)
    }

    // Dashboard data refreshed on backend → re-fetch summary
    const onDashboardStale = () => {
      fetchDashboardSummary().then(setDashSummary).catch(console.error)
    }

    // Modal open/close from another client
    const onModalToggled = (data: { modal: 'board' | 'dashboard'; open: boolean }) => {
      if (data.modal === 'board') setBoardOpen(data.open)
      if (data.modal === 'dashboard') setDashboardOpen(data.open)
    }

    socket.on('agent:statusChanged', onAgentStatus)
    socket.on('agent:walk', onAgentWalk)
    socket.on('board:changed', onBoardChanged)
    socket.on('dashboard:stale', onDashboardStale)
    socket.on('modal:toggled', onModalToggled)

    return () => {
      socket.off('agent:statusChanged', onAgentStatus)
      socket.off('agent:walk', onAgentWalk)
      socket.off('board:changed', onBoardChanged)
      socket.off('dashboard:stale', onDashboardStale)
      socket.off('modal:toggled', onModalToggled)
    }
  }, [socket])

  // Walk characters to their server-stored positions on first load
  const initialPositionSynced = useRef(false)
  useEffect(() => {
    if (initialPositionSynced.current || agents.length === 0) return
    if (!sceneRef.current) return
    for (const agent of agents) {
      if (agent.col != null && agent.row != null) {
        sceneRef.current.walkToTile(agent.id, agent.col, agent.row)
        sceneRef.current.setStatusEmoji(agent.id, agent.emoji)
      }
    }
    initialPositionSynced.current = true
  }, [agents])

  // Build RPG data map from dashboard summary
  const rpgDataMap: Record<string, AgentRpgData> = {}
  if (dashSummary) {
    for (const a of dashSummary.agents) {
      rpgDataMap[a.id] = {
        tokenToday: a.tokenUsage.today,
        tokenTotal: a.tokenUsage.total,
        tokenCap: Math.max(a.tokenUsage.total, 300_000),
      }
    }
  }

  const handleStatusChange = useCallback((id: string, status: string) => {
    // PATCH triggers backend broadcast via WebSocket → all clients update
    fetch(`/api/agents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(console.error)
  }, [])

  // Canvas click-to-walk broadcasts to other clients
  const handleCanvasWalk = useCallback((agentId: string, col: number, row: number) => {
    socket.emit('agent:walk', { agentId, col, row })
  }, [socket])

  const handleManualWalk = useCallback(() => {
    // Walk locally (immediate) + broadcast to other clients via WebSocket
    sceneRef.current?.walkToTile(selectedAgent, targetCol, targetRow)
    socket.emit('agent:walk', { agentId: selectedAgent, col: targetCol, row: targetRow })
  }, [socket, selectedAgent, targetCol, targetRow])

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', background: '#111', minHeight: '100vh', color: '#eee' }}>
      <h1 style={{ marginBottom: 4 }}>OpenClaw PixelAgent</h1>

      {healthError && <p style={{ color: 'red' }}>backend offline</p>}
      {health && (
        <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          status: <strong>{health.status}</strong> &nbsp;|&nbsp; version: <strong>{health.version}</strong>
        </p>
      )}

      {/* Main area: Canvas (left) + Agent Cards (right) */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
        {/* Pixel Scene */}
        <div style={{ flexShrink: 0 }}>
          <OfficeScene ref={sceneRef} onSelect={handleSelect} onWalk={handleCanvasWalk} />
        </div>

        {/* Agent Cards — vertical stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 380 }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#aaa' }}>Agents</h3>
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} rpg={rpgDataMap[agent.id]} onStatusChange={handleStatusChange} />
          ))}
        </div>
      </div>

      {/* Manual Walk Controls */}
      <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#1e1e2e', borderRadius: 8, display: 'inline-flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>手動移動</span>

        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          style={{ fontFamily: 'monospace', background: '#2a2a3e', color: '#eee', border: '1px solid #444', borderRadius: 4, padding: '2px 6px' }}
        >
          <option value="gaia">Gaia</option>
          <option value="astraea">Astraea</option>
        </select>

        <label style={{ fontSize: '0.8rem' }}>
          col&nbsp;
          <input
            type="number"
            min={0}
            max={COLS - 1}
            value={targetCol}
            onChange={(e) => setTargetCol(Number(e.target.value))}
            style={{ width: 44, fontFamily: 'monospace', background: '#2a2a3e', color: '#eee', border: '1px solid #444', borderRadius: 4, padding: '2px 4px' }}
          />
        </label>

        <label style={{ fontSize: '0.8rem' }}>
          row&nbsp;
          <input
            type="number"
            min={0}
            max={ROWS - 1}
            value={targetRow}
            onChange={(e) => setTargetRow(Number(e.target.value))}
            style={{ width: 44, fontFamily: 'monospace', background: '#2a2a3e', color: '#eee', border: '1px solid #444', borderRadius: 4, padding: '2px 4px' }}
          />
        </label>

        <button
          onClick={handleManualWalk}
          style={{ fontFamily: 'monospace', background: '#3a6ea5', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
        >
          走過去
        </button>
      </div>
      {/* Board Modal */}
      <BoardModal open={boardOpen} onClose={closeBoardModal} boardVersion={boardVersion} />
      {/* Dashboard Modal */}
      <DashboardModal open={dashboardOpen} onClose={closeDashboardModal} socket={socket} />
      {/* Shelf Modal */}
      <ShelfModal open={shelfOpen} onClose={() => setShelfOpen(false)} shelfId={shelfId} />
    </div>
  )
}

export default App
