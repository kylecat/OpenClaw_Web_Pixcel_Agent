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
  cronRuns: Record<string, CronRunInfo[]>   // jobId → recent runs
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
  openclaw: OpenClawInfo | null   // null if poll not yet completed
  lastUpdated: string             // ISO timestamp
}
