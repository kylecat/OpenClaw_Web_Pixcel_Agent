/* ------------------------------------------------------------------ */
/*  Dashboard Summary DTO                                              */
/* ------------------------------------------------------------------ */

export interface GatewayStatus {
  status: 'online' | 'offline' | 'degraded'
  version: string
  uptime: number        // seconds
  lastCheck: string     // ISO timestamp
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
  cpuUsage: number      // 0–100 %
  memTotal: number      // MB
  memUsed: number       // MB
  memUsage: number      // 0–100 %
  uptime: number        // seconds
}

export interface DashboardSummary {
  gateway: GatewayStatus
  agents: AgentOverview[]
  host: HostMetrics
  lastUpdated: string   // ISO timestamp
}
