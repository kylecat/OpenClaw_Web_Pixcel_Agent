const ALL_STATUSES = [
  'IDLE',
  'THINKING',
  'TALKING',
  'NETWORK_UNSTABLE',
  'ERROR',
  'CRASHED',
  'DONE',
] as const

type AgentStatus = (typeof ALL_STATUSES)[number]

export interface Agent {
  id: string
  displayName: string
  status: AgentStatus
  emoji: string
  lastSeenAt: string
}

interface Props {
  agent: Agent
  onStatusChange: (id: string, status: AgentStatus) => void
}

export function AgentCard({ agent, onStatusChange }: Props) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: '1rem', width: 220, fontFamily: 'monospace' }}>
      <div style={{ fontSize: '3rem', textAlign: 'center' }}>{agent.emoji}</div>
      <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 8 }}>{agent.displayName}</div>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span style={{ background: '#eee', borderRadius: 4, padding: '2px 8px', fontSize: '0.85rem' }}>
          {agent.status}
        </span>
      </div>
      <select
        value={agent.status}
        onChange={(e) => onStatusChange(agent.id, e.target.value as AgentStatus)}
        style={{ width: '100%', padding: '4px', fontFamily: 'monospace' }}
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 6 }}>
        {new Date(agent.lastSeenAt).toLocaleTimeString()}
      </div>
    </div>
  )
}
