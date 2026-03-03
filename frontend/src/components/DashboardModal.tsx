import { useState, useEffect, useCallback } from 'react'
import {
  fetchDashboardSummary,
  type DashboardSummary,
  type OpenClawInfo,
  type CronRunInfo,
} from '../api/dashboard'

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
        width: 720, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
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
              {data.openclaw && <SessionsSection sessions={data.openclaw.sessions} />}
              {data.openclaw && <CronSection openclaw={data.openclaw} />}
              <HostSection host={data.host} />

              {/* Last Updated */}
              <div style={{ textAlign: 'right', fontSize: 11, color: '#666', marginTop: 12 }}>
                Last updated: {new Date(data.lastUpdated).toLocaleString()}
                {data.openclaw && (
                  <span> | OpenClaw fetched: {new Date(data.openclaw.fetchedAt).toLocaleTimeString()}</span>
                )}
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
/*  Sessions Section (OpenClaw)                                        */
/* ================================================================== */

function SessionsSection({ sessions }: { sessions: OpenClawInfo['sessions'] }) {
  if (sessions.length === 0) return null
  return (
    <div style={sectionStyle}>
      <div style={sectionHeader}>Sessions</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Key</th>
              <th style={thStyle}>Kind</th>
              <th style={thStyle}>Age</th>
              <th style={thStyle}>Model</th>
              <th style={thStyle}>Tokens</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={i}>
                <td style={tdStyle} title={s.key}>
                  {s.key.length > 32 ? s.key.slice(0, 30) + '...' : s.key}
                </td>
                <td style={tdStyle}>{s.kind}</td>
                <td style={tdStyle}>{s.age}</td>
                <td style={tdStyle}>{s.model}</td>
                <td style={tdStyle}>{s.tokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Cron Jobs Section (OpenClaw)                                       */
/* ================================================================== */

const CRON_STATUS_COLOR: Record<string, string> = {
  ok: '#27ae60',
  error: '#e74c3c',
  running: '#3498db',
}

function CronSection({ openclaw }: { openclaw: OpenClawInfo }) {
  const { cronJobs, cronRuns } = openclaw
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  if (cronJobs.length === 0) return null

  return (
    <div style={sectionStyle}>
      <div style={sectionHeader}>Cron Jobs</div>
      {cronJobs.map(job => {
        const runs = cronRuns[job.id] ?? []
        const isExpanded = expandedJob === job.id

        return (
          <div key={job.id} style={{
            border: '1px solid #333', borderRadius: 6,
            marginBottom: 8, background: '#1e1e2e',
          }}>
            {/* Job header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', cursor: 'pointer',
              }}
              onClick={() => setExpandedJob(isExpanded ? null : job.id)}
            >
              <span style={{ fontSize: 11, color: '#666' }}>{isExpanded ? '▼' : '▶'}</span>
              <span style={{ fontSize: 12, fontWeight: 'bold', flex: 1 }}>
                {job.name || job.id.slice(0, 8)}
              </span>
              <span style={badge(CRON_STATUS_COLOR[job.status] ?? '#888')}>{job.status}</span>
              <InfoPair label="agent" value={job.agentId} />
              <InfoPair label="next" value={job.next} />
              <InfoPair label="last" value={job.last} />
            </div>

            {/* Expanded: schedule + recent runs */}
            {isExpanded && (
              <div style={{ padding: '0 10px 10px', borderTop: '1px solid #333' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }}>
                  <InfoPair label="schedule" value={job.schedule} />
                  <InfoPair label="target" value={job.target} />
                  <InfoPair label="model" value={job.model || '-'} />
                </div>

                {runs.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Recent Runs</div>
                    {runs.map((run, i) => (
                      <CronRunRow key={i} run={run} />
                    ))}
                  </>
                )}
                {runs.length === 0 && (
                  <div style={{ fontSize: 11, color: '#666' }}>No recent runs</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CronRunRow({ run }: { run: CronRunInfo }) {
  const [showSummary, setShowSummary] = useState(false)
  const color = CRON_STATUS_COLOR[run.status] ?? '#888'
  const durSec = Math.round(run.durationMs / 1000)
  const time = new Date(run.ts).toLocaleString()

  return (
    <div style={{
      borderBottom: '1px solid #2a2a3a', padding: '4px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: color,
          display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, color: '#aaa' }}>{time}</span>
        <span style={{ fontSize: 10, color }}>{run.status}</span>
        <InfoPair label="duration" value={`${durSec}s`} />
        <InfoPair label="model" value={run.model} />
        <InfoPair label="tokens" value={`${run.usage.total_tokens.toLocaleString()}`} />
        <InfoPair label="delivery" value={run.deliveryStatus} />
        {(run.summary || run.error) && (
          <button
            onClick={() => setShowSummary(!showSummary)}
            style={{
              background: 'none', border: '1px solid #444', color: '#aaa',
              fontSize: 10, borderRadius: 3, padding: '1px 6px', cursor: 'pointer',
            }}
          >
            {showSummary ? 'hide' : 'detail'}
          </button>
        )}
      </div>
      {showSummary && (run.summary || run.error) && (
        <div style={{
          marginTop: 4, padding: 8, background: '#1a1a2e', borderRadius: 4,
          fontSize: 11, color: run.error ? '#e74c3c' : '#bbb',
          maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap',
          lineHeight: 1.4,
        }}>
          {run.error || (run.summary && run.summary.length > 500
            ? run.summary.slice(0, 500) + '...'
            : run.summary)}
        </div>
      )}
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

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 11,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', color: '#888', padding: '4px 6px',
  borderBottom: '1px solid #333', fontWeight: 'normal',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '4px 6px', color: '#ccc',
  borderBottom: '1px solid #2a2a3a',
  whiteSpace: 'nowrap',
}
