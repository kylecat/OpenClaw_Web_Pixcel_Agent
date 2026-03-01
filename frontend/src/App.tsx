import { useCallback, useEffect, useState } from 'react'
import { AgentCard } from './components/AgentCard'
import type { Agent } from './components/AgentCard'

interface HealthResponse {
  status: string
  version: string
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch(() => setHealthError(true))

    fetch('/api/agents')
      .then((res) => res.json() as Promise<Agent[]>)
      .then(setAgents)
      .catch(console.error)
  }, [])

  const handleStatusChange = useCallback((id: string, status: string) => {
    fetch(`/api/agents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then((res) => res.json() as Promise<Agent>)
      .then((updated) =>
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a))),
      )
      .catch(console.error)
  }, [])

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>OpenClaw PixelAgent</h1>

      {healthError && <p style={{ color: 'red' }}>backend offline</p>}
      {health && (
        <p>
          status: <strong>{health.status}</strong> &nbsp;|&nbsp; version:{' '}
          <strong>{health.version}</strong>
        </p>
      )}

      <h2>Agents</h2>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onStatusChange={handleStatusChange} />
        ))}
      </div>
    </div>
  )
}

export default App
