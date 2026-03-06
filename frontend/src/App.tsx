import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgentCard } from './components/AgentCard'
import { SceneCanvas } from './components/SceneCanvas'
import { BoardModal } from './components/BoardModal'
import { DashboardModal } from './components/DashboardModal'
import { ShelfModal } from './components/ShelfModal'
import type { Agent, AgentRpgData } from './components/AgentCard'
import type { SceneCanvasHandle, WalkTarget } from './components/SceneCanvas'
import type { SelectedObject } from './scene/types'
import { indoorConfig } from './scene/indoor/indoorConfig'
import { outdoorConfig } from './scene/outdoor/outdoorConfig'
import { fetchDashboardSummary, type DashboardSummary } from './api/dashboard'
import { useSocket } from './hooks/useSocket'
import { useSceneNavigation } from './hooks/useSceneNavigation'

interface HealthResponse {
  status: string
  version: string
}

const SCENE_CONFIGS = {
  indoor: indoorConfig,
  outdoor: outdoorConfig,
} as const

// Default home tile per scene (for manual walk control defaults)
const SCENE_HOME: Record<string, { col: number; row: number }> = {
  indoor: { col: 6, row: 6 },
  outdoor: { col: 8, row: 8 },
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

const FADE_MS = 400

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const sceneRef = useRef<SceneCanvasHandle>(null)
  const socket = useSocket()

  // Scene navigation (each tab independent)
  const sceneNav = useSceneNavigation('indoor')

  const activeConfig = SCENE_CONFIGS[sceneNav.currentScene]

  // Compute which agents are visible in the current scene
  // undefined = agents not loaded yet → show all (no filtering)
  const visibleAgents = useMemo(() => {
    if (agents.length === 0) return undefined // not loaded yet, show all
    const set = new Set<string>()
    for (const a of agents) {
      if ((a.scene ?? 'indoor') === sceneNav.currentScene) set.add(a.id)
    }
    return set
  }, [agents, sceneNav.currentScene])

  // Board modal
  const [boardOpen, setBoardOpen] = useState(false)
  // Dashboard modal
  const [dashboardOpen, setDashboardOpen] = useState(false)
  // Shelf modal
  const [shelfOpen, setShelfOpen] = useState(false)
  const [shelfId, setShelfId] = useState<'shelf1' | 'shelf2' | 'shelf3'>('shelf1')

  // Move agent to another scene (local + backend + WebSocket)
  const moveAgentToScene = useCallback((agentId: string, scene: 'indoor' | 'outdoor') => {
    // Update local agent state immediately
    setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, scene } : a))
    // Persist to backend + broadcast to other tabs
    fetch(`/api/agents/${agentId}/scene`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene }),
    }).catch(console.error)
    socket.emit('agent:scene', { agentId, scene })
  }, [socket])

  // Ref to track the currently selected character (for scene transitions)
  const selectedCharRef = useRef<string | null>(null)

  const handleSelect = useCallback((obj: SelectedObject | null) => {
    // Track selected character for scene transitions
    selectedCharRef.current = obj?.kind === 'character' ? obj.id : null

    if (obj?.kind === 'board') {
      setBoardOpen(true)
    }
    if (obj?.kind === 'dashboard') {
      setDashboardOpen(true)
    }
    // Indoor exit/portal -> move selected agent to outdoor + switch view
    if (obj?.kind === 'exitDoor' || obj?.kind === 'portal') {
      if (selectedCharRef.current) {
        moveAgentToScene(selectedCharRef.current, 'outdoor')
      }
      sceneNav.goTo('outdoor')
    }
    // Outdoor cabin -> move selected agent to indoor + switch view
    if (obj?.kind === 'cabin') {
      if (selectedCharRef.current) {
        moveAgentToScene(selectedCharRef.current, 'indoor')
      }
      sceneNav.goTo('indoor')
    }
    if (obj?.kind === 'decoration' && (obj.decoKind === 'shelf1' || obj.decoKind === 'shelf2' || obj.decoKind === 'shelf3')) {
      setShelfId(obj.decoKind as 'shelf1' | 'shelf2' | 'shelf3')
      setShelfOpen(true)
    }
  }, [sceneNav, moveAgentToScene])

  const closeBoardModal = useCallback(() => {
    setBoardOpen(false)
  }, [])

  const closeDashboardModal = useCallback(() => {
    setDashboardOpen(false)
  }, [])

  // Dashboard summary for RPG card data
  const [dashSummary, setDashSummary] = useState<DashboardSummary | null>(null)

  // Manual walk controls -- reset defaults on scene switch
  const [selectedAgent, setSelectedAgent] = useState<string>('gaia')
  const [targetCol, setTargetCol] = useState<number>(SCENE_HOME.indoor.col)
  const [targetRow, setTargetRow] = useState<number>(SCENE_HOME.indoor.row)
  const prevSceneRef = useRef(sceneNav.currentScene)
  if (prevSceneRef.current !== sceneNav.currentScene) {
    prevSceneRef.current = sceneNav.currentScene
    const home = SCENE_HOME[sceneNav.currentScene] ?? SCENE_HOME.indoor
    setTargetCol(home.col)
    setTargetRow(home.row)
  }

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
            // Sync position if server position differs from last known
            if (old && agent.col != null && agent.row != null &&
                (old.col !== agent.col || old.row !== agent.row)) {
              sceneRef.current?.walkToTile(agent.id, agent.col, agent.row)
            }
          }
          return latest
        })
      })
      .catch(console.error)
    fetchDashboardSummary().then(setDashSummary).catch(console.error)
  }, [])

  // Periodic sync
  useEffect(() => {
    const timer = setInterval(syncAgentsFromServer, 5_000)
    return () => clearInterval(timer)
  }, [syncAgentsFromServer])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncAgentsFromServer()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [syncAgentsFromServer])

  // --- WebSocket listeners ---
  useEffect(() => {
    const onAgentStatus = (agent: Agent) => {
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? agent : a)))
      const target = STATUS_WALK_MAP[agent.status] ?? 'home'
      sceneRef.current?.walkAgent(agent.id, target)
      sceneRef.current?.setStatusEmoji(agent.id, agent.emoji)
    }

    const onAgentWalk = (data: { agentId: string; col: number; row: number }) => {
      sceneRef.current?.walkToTile(data.agentId, data.col, data.row)
    }

    const onBoardChanged = () => setBoardVersion((v) => v + 1)
    const onDashboardStale = () => fetchDashboardSummary().then(setDashSummary).catch(console.error)

    socket.on('agent:statusChanged', onAgentStatus)
    socket.on('agent:walk', onAgentWalk)
    socket.on('board:changed', onBoardChanged)
    socket.on('dashboard:stale', onDashboardStale)

    return () => {
      socket.off('agent:statusChanged', onAgentStatus)
      socket.off('agent:walk', onAgentWalk)
      socket.off('board:changed', onBoardChanged)
      socket.off('dashboard:stale', onDashboardStale)
    }
  }, [socket])

  // Walk characters to their server-stored positions on first load (indoor only)
  const initialPositionSynced = useRef(false)
  useEffect(() => {
    if (initialPositionSynced.current || agents.length === 0) return
    if (!sceneRef.current) return
    if (sceneNav.currentScene !== 'indoor') return
    for (const agent of agents) {
      if (agent.col != null && agent.row != null && (agent.scene ?? 'indoor') === 'indoor') {
        sceneRef.current.walkToTile(agent.id, agent.col, agent.row)
        sceneRef.current.setStatusEmoji(agent.id, agent.emoji)
      }
    }
    initialPositionSynced.current = true
  }, [agents, sceneNav.currentScene])

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
    fetch(`/api/agents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(console.error)
  }, [])

  const handleCanvasWalk = useCallback((agentId: string, col: number, row: number) => {
    socket.emit('agent:walk', { agentId, col, row })
  }, [socket])

  const handleManualWalk = useCallback(() => {
    sceneRef.current?.walkToTile(selectedAgent, targetCol, targetRow)
    socket.emit('agent:walk', { agentId: selectedAgent, col: targetCol, row: targetRow })
  }, [socket, selectedAgent, targetCol, targetRow])

  // Agent Card scene switch -> navigate to agent's scene
  const handleSceneSwitch = useCallback((scene: 'indoor' | 'outdoor') => {
    sceneNav.goTo(scene)
  }, [sceneNav])

  // Only show agents in current scene for manual walk dropdown
  const agentsInScene = agents.filter((a) => (a.scene ?? 'indoor') === sceneNav.currentScene)

  // Auto-select the first agent in the current scene when scene changes or agents move
  const prevAgentsInSceneRef = useRef<string[]>([])
  const agentIdsInScene = agentsInScene.map((a) => a.id)
  if (agentIdsInScene.join(',') !== prevAgentsInSceneRef.current.join(',')) {
    prevAgentsInSceneRef.current = agentIdsInScene
    if (agentIdsInScene.length > 0 && !agentIdsInScene.includes(selectedAgent)) {
      setSelectedAgent(agentIdsInScene[0])
    }
  }

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
        {/* Pixel Scene with fade transition */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <div style={{
            opacity: sceneNav.opacity,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}>
            <SceneCanvas
              key={`${sceneNav.currentScene}-${agents.length > 0 ? 'loaded' : 'init'}`}
              ref={sceneRef}
              config={activeConfig}
              onSelect={handleSelect}
              onWalk={handleCanvasWalk}
              visibleAgents={visibleAgents}
            />
          </div>
          {/* Scene indicator */}
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.6)',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: '0.75rem',
            color: '#aaa',
          }}>
            {sceneNav.currentScene === 'indoor' ? 'Office' : 'Farm'}
          </div>
        </div>

        {/* Agent Cards -- vertical stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 380 }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#aaa' }}>Agents</h3>
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              rpg={rpgDataMap[agent.id]}
              onStatusChange={handleStatusChange}
              currentScene={sceneNav.currentScene}
              onSceneSwitch={handleSceneSwitch}
            />
          ))}
        </div>
      </div>

      {/* Manual Walk Controls */}
      <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#1e1e2e', borderRadius: 8, display: 'inline-flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
          {sceneNav.currentScene === 'indoor' ? 'Office' : 'Farm'}
        </span>

        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          style={{ fontFamily: 'monospace', background: '#2a2a3e', color: '#eee', border: '1px solid #444', borderRadius: 4, padding: '2px 6px' }}
        >
          {agentsInScene.length > 0
            ? agentsInScene.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)
            : <option disabled>No agents here</option>
          }
        </select>

        <label style={{ fontSize: '0.8rem' }}>
          col&nbsp;
          <input
            type="number"
            min={0}
            max={activeConfig.cols - 1}
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
            max={activeConfig.rows - 1}
            value={targetRow}
            onChange={(e) => setTargetRow(Number(e.target.value))}
            style={{ width: 44, fontFamily: 'monospace', background: '#2a2a3e', color: '#eee', border: '1px solid #444', borderRadius: 4, padding: '2px 4px' }}
          />
        </label>

        <button
          onClick={handleManualWalk}
          disabled={agentsInScene.length === 0}
          style={{ fontFamily: 'monospace', background: '#3a6ea5', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
        >
          走過去
        </button>

        {/* Scene switch button — moves selected agent + switches view */}
        <button
          onClick={() => {
            const targetScene = sceneNav.currentScene === 'indoor' ? 'outdoor' : 'indoor'
            if (selectedAgent) {
              moveAgentToScene(selectedAgent, targetScene)
            }
            sceneNav.goTo(targetScene)
          }}
          disabled={sceneNav.transition !== 'idle' || agentsInScene.length === 0}
          style={{
            fontFamily: 'monospace',
            background: sceneNav.currentScene === 'indoor' ? '#2e7d32' : '#5c6bc0',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '4px 12px',
            cursor: sceneNav.transition !== 'idle' ? 'not-allowed' : 'pointer',
            opacity: sceneNav.transition !== 'idle' ? 0.5 : 1,
          }}
        >
          {sceneNav.currentScene === 'indoor' ? 'Go Outside' : 'Go Inside'}
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
