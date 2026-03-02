import { useState, useEffect, useCallback } from 'react'
import { fetchDashboardSummary, type DashboardSummary } from '../api/dashboard'

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

interface DashboardModalProps {
  open: boolean
  onClose: () => void
}

/* ================================================================== */
/*  Color helpers                                                      */
/* ================================================================== */

const GW_STATUS_COLOR: Record<string, string> = {
  online: '#27ae60',
  degraded: '#f39c12',
  offline: '#e74c3c',
}

const AGENT_STATUS_COLOR: Record<string, string> = {
  IDLE: '#888',
  THINKING: '#f39c12',
  TALKING: '#3498db',
  NETWORK_UNSTABLE: '#f39c12',
  ERROR: '#e74c3c',
  CRASHED: '#c0392b',
  DONE: '#27ae60',
}

/* ================================================================== */
/*  DashboardModal                                                     */
/* ================================================================== */

export function DashboardModal({ open, onClose }: DashboardModalProps) {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const summary = await fetchDashboardSummary()
      setData(summary)
    } catch (e) {
      console.error('Dashboard reload failed', e)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) reload()
  }, [open, reload])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#1e1e2e', border: '1px solid #444', borderRadius: 12,
        color: '#eee', fontFamily: 'monospace',
        width: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #333',
        }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>Dashboard</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={reload} disabled={loading} style={btnStyle}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#aaa',
                fontSize: 20, cursor: 'pointer', lineHeight: 1,
              }}
            >x</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && !data && (
            <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>Loading...</div>
          )}
          {error && !data && (
            <div style={{ color: '#e74c3c', textAlign: 'center', padding: 32 }}>{error}</div>
          )}
          {data && (
            <>
              <GatewaySection gateway={data.gateway} />
              <AgentsSection agents={data.agents} />
              <HostSection host={data.host} />

              {/* Last Updated */}
              <div style={{ textAlign: 'right', fontSize: 11, color: '#666', marginTop: 12 }}>
                Last updated: {new Date(data.lastUpdated).toLocaleString()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Gateway Section                                                    */
/* ================================================================== */

function GatewaySection({ gateway }: { gateway: DashboardSummary['gateway'] }) {
  const color = GW_STATUS_COLOR[gateway.status] ?? '#888'
  return (
    <div style={sectionStyle}>
      <div style={sectionHeader}>Gateway</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10,
            borderRadius: '50%', background: color,
            boxShadow: `0 0 6px ${color}`,
          }} />
          <span style={{ fontSize: 13, fontWeight: 'bold', color }}>{gateway.status}</span>
        </div>
        <InfoPair label="version" value={gateway.version} />
        <InfoPair label="uptime" value={formatUptime(gateway.uptime)} />
        <InfoPair label="last check" value={new Date(gateway.lastCheck).toLocaleTimeString()} />
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Agents Section                                                     */
/* ================================================================== */

function AgentsSection({ agents }: { agents: DashboardSummary['agents'] }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeader}>Agents</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {agents.map(a => (
          <div key={a.id} style={{
            flex: 1, minWidth: 240,
            border: '1px solid #333', borderRadius: 8, padding: 10,
            background: '#242438',
          }}>
            {/* Name + Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{a.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 'bold' }}>{a.displayName}</span>
              <span style={badge(AGENT_STATUS_COLOR[a.status] ?? '#888')}>{a.status}</span>
            </div>
            {/* Model + Tokens */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <InfoPair label="model" value={a.model} />
              <div style={{ display: 'flex', gap: 12 }}>
                <InfoPair label="today" value={`${a.tokenUsage.today.toLocaleString()} tok`} />
                <InfoPair label="total" value={`${a.tokenUsage.total.toLocaleString()} tok`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Host Section                                                       */
/* ================================================================== */

function HostSection({ host }: { host: DashboardSummary['host'] }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeader}>Host</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <InfoPair label="hostname" value={host.hostname} />
        <InfoPair label="platform" value={`${host.platform} / ${host.arch}`} />
        <InfoPair label="uptime" value={formatUptime(host.uptime)} />
      </div>
      {/* CPU bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
          <span style={{ color: '#aaa' }}>CPU</span>
          <span style={{ color: barColor(host.cpuUsage) }}>{host.cpuUsage}%</span>
        </div>
        <ProgressBar value={host.cpuUsage} />
      </div>
      {/* Memory bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
          <span style={{ color: '#aaa' }}>Memory</span>
          <span style={{ color: barColor(host.memUsage) }}>
            {host.memUsed} / {host.memTotal} MB ({host.memUsage}%)
          </span>
        </div>
        <ProgressBar value={host.memUsage} />
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Shared components & helpers                                        */
/* ================================================================== */

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 11 }}>
      <span style={{ color: '#888' }}>{label}: </span>
      <span style={{ color: '#ccc' }}>{value}</span>
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  const color = barColor(value)
  return (
    <div style={{
      width: '100%', height: 8, background: '#1a1a2e',
      borderRadius: 4, overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(value, 100)}%`, height: '100%',
        background: color, borderRadius: 4,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function barColor(pct: number): string {
  if (pct >= 90) return '#e74c3c'
  if (pct >= 70) return '#f39c12'
  return '#27ae60'
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/* ================================================================== */
/*  Shared inline styles                                               */
/* ================================================================== */

const btnStyle: React.CSSProperties = {
  fontFamily: 'monospace', background: '#3a6ea5', color: '#fff',
  border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer',
  fontSize: 12,
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 16, padding: 12,
  background: '#242438', borderRadius: 8, border: '1px solid #333',
}

const sectionHeader: React.CSSProperties = {
  fontSize: 13, fontWeight: 'bold', color: '#aaa',
  marginBottom: 8, textTransform: 'uppercase',
  letterSpacing: 1,
}

function badge(color: string): React.CSSProperties {
  return {
    fontSize: 10, fontWeight: 'bold', color: '#fff',
    background: color, borderRadius: 4, padding: '1px 6px',
    textTransform: 'uppercase',
  }
}
