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

export interface DashboardSummary {
  gateway: GatewayStatus
  agents: AgentOverview[]
  host: HostMetrics
  lastUpdated: string
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch('/api/dashboard/summary')
  if (!res.ok) throw new Error(`fetchDashboardSummary failed: ${res.status}`)
  return res.json()
}
