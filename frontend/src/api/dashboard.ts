/* ------------------------------------------------------------------ */
/*  Dashboard API — Summary fetch helper                               */
/* ------------------------------------------------------------------ */

export interface GatewayStatus {
  status: 'online' | 'offline' | 'degraded'
  version: string
  uptime: number
  lastCheck: string
}

export interface AgentOverview {
  id: string
  displayName: string
  status: string
  emoji: string
  model: string
  tokenUsage: { today: number; total: number }
}

export interface HostMetrics {
  hostname: string
  platform: string
  arch: string
  cpuUsage: number
  memTotal: number
  memUsed: number
  memUsage: number
  uptime: number
}

/* ------------------------------------------------------------------ */
/*  OpenClaw sections (T7)                                             */
/* ------------------------------------------------------------------ */

export interface SessionInfo {
  key: string
  kind: string
  age: string
  model: string
  tokens: string
}

export interface CronJobInfo {
  id: string
  name: string
  schedule: string
  next: string
  last: string
  status: string
  target: string
  agentId: string
  model: string
}

export interface CronRunInfo {
  ts: number
  status: string
  summary?: string
  error?: string
  durationMs: number
  model: string
  provider: string
  usage: { input_tokens: number; output_tokens: number; total_tokens: number }
  deliveryStatus: string
}

export interface OpenClawInfo {
  sessions: SessionInfo[]
  cronJobs: CronJobInfo[]
  cronRuns: Record<string, CronRunInfo[]>
  channels: { channel: string; enabled: string; state: string; detail: string }[]
  security: { summary: string }
  fetchedAt: string
}

/* ------------------------------------------------------------------ */
/*  Combined Summary                                                   */
/* ------------------------------------------------------------------ */

export interface DashboardSummary {
  gateway: GatewayStatus
  agents: AgentOverview[]
  host: HostMetrics
  openclaw: OpenClawInfo | null
  lastUpdated: string
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch('/api/dashboard/summary')
  if (!res.ok) throw new Error(`fetchDashboardSummary failed: ${res.status}`)
  return res.json()
}
