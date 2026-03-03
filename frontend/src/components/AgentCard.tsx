import { useEffect, useRef, useState } from 'react'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

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
  model: string
  lastSeenAt: string
  col?: number
  row?: number
}

/** Extra data optionally passed from dashboard summary */
export interface AgentRpgData {
  tokenToday: number
  tokenTotal: number
  tokenCap: number
  currentTask?: string
}

interface Props {
  agent: Agent
  rpg?: AgentRpgData
  onStatusChange: (id: string, status: AgentStatus) => void
}

/* ================================================================== */
/*  Per-agent RPG metadata                                             */
/* ================================================================== */

interface RpgMeta {
  class: string
  title: string
  skills: string[]
  stats: { str: number; agi: number; con: number; luk: number }
  bonuses: { str: number; agi: number; con: number; luk: number }
  spriteCol: number
  spriteRow: number
}

const RPG_META: Record<string, RpgMeta> = {
  gaia: {
    class: 'RESEARCH MAGE',
    title: 'DEEP-READER',
    skills: ['DEEP SEARCH', 'WEB FETCH', 'SUMMARIZE', 'CITE'],
    stats: { str: 50, agi: 65, con: 55, luk: 60 },
    bonuses: { str: 5, agi: 8, con: 3, luk: 5 },
    spriteCol: 0,
    spriteRow: 0,
  },
  astraea: {
    class: 'STELLAR MAGE',
    title: 'STAR-GAZER',
    skills: ['STARFALL', 'NEBULA HEAL', 'SILENCE', 'SCRIBE'],
    stats: { str: 45, agi: 60, con: 55, luk: 70 },
    bonuses: { str: 5, agi: 8, con: 5, luk: 10 },
    spriteCol: 0,
    spriteRow: 0,
  },
}

/* ================================================================== */
/*  Status helpers                                                     */
/* ================================================================== */

const STATUS_HP: Record<string, number> = {
  IDLE: 100, THINKING: 85, TALKING: 90, DONE: 100,
  NETWORK_UNSTABLE: 60, ERROR: 30, CRASHED: 5,
}

const STATUS_COLOR: Record<string, string> = {
  IDLE: '#888', THINKING: '#f39c12', TALKING: '#3498db',
  NETWORK_UNSTABLE: '#f39c12', ERROR: '#e74c3c', CRASHED: '#c0392b', DONE: '#27ae60',
}

/* ================================================================== */
/*  Portrait                                                           */
/* ================================================================== */

const FRAME_W = 16
const FRAME_H = 32

function Portrait({ agentId, meta }: { agentId: string; meta: RpgMeta }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const img = new Image()
    img.src = `/assets/characters/${agentId}.png`
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const sx = meta.spriteCol * FRAME_W
      const sy = meta.spriteRow * FRAME_H
      ctx.drawImage(img, sx, sy, FRAME_W, FRAME_H, 0, 0, canvas.width, canvas.height)
    }
  }, [agentId, meta])

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={128}
      style={{ width: 64, height: 128, imageRendering: 'pixelated' }}
    />
  )
}

/* ================================================================== */
/*  Bar components                                                     */
/* ================================================================== */

function StatBar({ label, value, max, color, showText }: {
  label: string; value: number; max: number; color: string; showText?: string
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
      <span style={{ ...lbl, width: 22, color: '#ccc' }}>{label}</span>
      <div style={{
        flex: 1, height: 10, background: '#1a1a2e',
        border: '1px solid #333', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ ...lbl, width: 70, textAlign: 'right', color: '#aaa' }}>
        {showText ?? `${value}/${max}`}
      </span>
    </div>
  )
}

function MiniStat({ label, base, bonus }: { label: string; base: number; bonus: number }) {
  return (
    <span style={{ ...lbl, marginRight: 8 }}>
      <span style={{ color: '#ccc' }}>{label}: </span>
      <span style={{ color: '#fff' }}>{base}</span>
      {bonus > 0 && <span style={{ color: '#27ae60' }}>{` (+${bonus})`}</span>}
    </span>
  )
}

/* ================================================================== */
/*  Collapsed row                                                      */
/* ================================================================== */

function CollapsedCard({ agent, meta, onToggle }: {
  agent: Agent; meta: RpgMeta; onToggle: () => void
}) {
  const uptime = fmtUptime(agent.lastSeenAt)
  const color = STATUS_COLOR[agent.status] ?? '#888'

  return (
    <div style={{ ...cardStyle, cursor: 'pointer' }} onClick={onToggle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', width: '100%' }}>
        {/* Small portrait */}
        <PortraitSmall agentId={agent.id} meta={meta} />

        {/* Name */}
        <span style={{ fontSize: 11, fontWeight: 'bold', color: '#f0e68c', minWidth: 60 }}>
          {agent.displayName.toUpperCase()}
        </span>

        {/* Status */}
        <span style={{ fontSize: 11, color, fontWeight: 'bold' }}>
          {agent.emoji} {agent.status}
        </span>

        {/* Uptime pushed right */}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#888' }}>
          {uptime}
        </span>

        {/* Expand hint */}
        <span style={{ fontSize: 10, color: '#555' }}>&#9660;</span>
      </div>
    </div>
  )
}

/** Small 32x64 portrait for collapsed view */
function PortraitSmall({ agentId, meta }: { agentId: string; meta: RpgMeta }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const img = new Image()
    img.src = `/assets/characters/${agentId}.png`
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const sx = meta.spriteCol * FRAME_W
      const sy = meta.spriteRow * FRAME_H
      ctx.drawImage(img, sx, sy, FRAME_W, FRAME_H, 0, 0, canvas.width, canvas.height)
    }
  }, [agentId, meta])

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={64}
      style={{ width: 32, height: 64, imageRendering: 'pixelated', flexShrink: 0 }}
    />
  )
}

/* ================================================================== */
/*  AgentCard (collapsible)                                            */
/* ================================================================== */

export function AgentCard({ agent, rpg, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const meta = RPG_META[agent.id] ?? RPG_META.gaia

  if (!expanded) {
    return <CollapsedCard agent={agent} meta={meta} onToggle={() => setExpanded(true)} />
  }

  const hp = STATUS_HP[agent.status] ?? 100
  const hpMax = 100
  const mp = Math.round(hp * 0.8 + 15)
  const mpMax = 100

  const tokenToday = rpg?.tokenToday ?? 0
  const tokenTotal = rpg?.tokenTotal ?? 0
  const tokenCap = rpg?.tokenCap ?? 300000

  const modelShort = agent.model.length > 22 ? agent.model.slice(0, 20) + '..' : agent.model

  return (
    <div style={{ ...cardStyle, cursor: 'pointer' }} onClick={() => setExpanded(false)}>
      {/* Left: Portrait */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '8px 6px 4px', borderRight: '1px solid #333', minWidth: 76,
      }}>
        <Portrait agentId={agent.id} meta={meta} />
        <div style={{ fontSize: 11, fontWeight: 'bold', color: '#f0e68c', marginTop: 4, textAlign: 'center' }}>
          {agent.displayName.toUpperCase()}
        </div>
        <select
          value={agent.status}
          onChange={e => { e.stopPropagation(); onStatusChange(agent.id, e.target.value as AgentStatus) }}
          onClick={e => e.stopPropagation()}
          style={selectStyle}
        >
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Right: Stats */}
      <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {/* Header row */}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}
        >
          <div>
            <span style={{ ...lbl, color: '#888' }}>CLASS </span>
            <span style={{ ...lbl, color: '#ccc' }}>{meta.class}</span>
            <span style={{ ...lbl, color: '#888', marginLeft: 8 }}>TITLE </span>
            <span style={{ ...lbl, color: '#f0e68c' }}>{meta.title}</span>
          </div>
          <span style={{ fontSize: 10, color: '#555' }}>&#9650;</span>
        </div>

        {/* HP / MP / EXP */}
        <StatBar label="HP" value={hp} max={hpMax} color={hp > 50 ? '#27ae60' : hp > 20 ? '#f39c12' : '#e74c3c'} showText={`${hp}/${hpMax}`} />
        <StatBar label="MP" value={mp} max={mpMax} color="#3498db" showText={`${mp}/${mpMax}`} />
        <StatBar label="EXP" value={tokenToday} max={tokenCap} color="#9b59b6" showText={`${fmtK(tokenToday)}/${fmtK(tokenCap)}`} />

        {/* Stats */}
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 2, marginBottom: 2 }}>
          <MiniStat label="STR" base={meta.stats.str} bonus={meta.bonuses.str} />
          <MiniStat label="AGI" base={meta.stats.agi} bonus={meta.bonuses.agi} />
          <MiniStat label="CON" base={meta.stats.con} bonus={meta.bonuses.con} />
          <MiniStat label="LUK" base={meta.stats.luk} bonus={meta.bonuses.luk} />
        </div>

        <div style={{ borderTop: '1px solid #333', marginTop: 2, marginBottom: 2 }} />

        {/* System Info */}
        <div>
          <div style={{ ...lbl, color: '#888', marginBottom: 2 }}>SYSTEM INFO</div>
          <InfoRow label="model" value={modelShort} />
          <InfoRow label="today" value={`${fmtK(tokenToday)} tok`} />
          <InfoRow label="total" value={`${fmtK(tokenTotal)} tok`} />
          {rpg?.currentTask && <InfoRow label="task" value={rpg.currentTask} />}
        </div>

        {/* Behavior */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ ...lbl, color: '#888' }}>BEHAVIOR:</span>
          <span style={{ ...lbl, color: STATUS_COLOR[agent.status] ?? '#888', fontWeight: 'bold' }}>
            {agent.emoji} {agent.status}
          </span>
        </div>

        {/* Skills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
          <span style={{ ...lbl, color: '#888' }}>SKILLS</span>
          {meta.skills.map(s => <span key={s} style={skillBadge}>{s}</span>)}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...lbl, lineHeight: 1.5 }}>
      <span style={{ color: '#666' }}>{label}: </span>
      <span style={{ color: '#ccc' }}>{value}</span>
    </div>
  )
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function fmtUptime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  if (ms < 0) return '0d 0h'
  const totalH = Math.floor(ms / 3_600_000)
  const d = Math.floor(totalH / 24)
  const h = totalH % 24
  return `${d}d ${h}h`
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const cardStyle: React.CSSProperties = {
  display: 'flex',
  background: '#16162a',
  border: '2px solid #444',
  borderRadius: 6,
  fontFamily: 'monospace',
  color: '#eee',
  overflow: 'hidden',
  width: 380,
  boxShadow: '0 0 8px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.3)',
}

const lbl: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.3,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 4,
  fontFamily: 'monospace',
  fontSize: 9,
  background: '#1a1a2e',
  color: '#aaa',
  border: '1px solid #444',
  borderRadius: 3,
  padding: '1px 2px',
  cursor: 'pointer',
}

const skillBadge: React.CSSProperties = {
  fontSize: 9,
  color: '#aaa',
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: 3,
  padding: '1px 5px',
}
