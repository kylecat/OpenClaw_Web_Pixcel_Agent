/* ------------------------------------------------------------------ */
/*  OpenClaw structured DTOs — parsed from CLI output                  */
/* ------------------------------------------------------------------ */

/** Single key-value row from `openclaw status` Overview table */
export interface OpenClawStatusOverview {
  dashboard: string
  os: string
  tailscale: string
  channel: string
  update: string
  gateway: string
  gatewayService: string
  nodeService: string
  agents: string
  memory: string
  heartbeat: string
  sessions: string
}

/** Session row from `openclaw status` Sessions table */
export interface OpenClawSession {
  key: string
  kind: string
  age: string
  model: string
  tokens: string
}

/** Channel row from `openclaw status` Channels table */
export interface OpenClawChannel {
  channel: string
  enabled: string
  state: string
  detail: string
}

/** Full parsed result of `openclaw status` */
export interface OpenClawStatus {
  overview: OpenClawStatusOverview
  sessions: OpenClawSession[]
  channels: OpenClawChannel[]
  security: { summary: string }
}

/** Cron job from `openclaw cron list` */
export interface OpenClawCronJob {
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

/** Single cron run entry (JSON from `openclaw cron runs`) */
export interface OpenClawCronRun {
  ts: number
  jobId: string
  action: string
  status: string
  summary?: string
  error?: string
  runAtMs: number
  durationMs: number
  nextRunAtMs: number
  model: string
  provider: string
  usage: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  delivered: boolean
  deliveryStatus: string
  sessionId: string
  sessionKey: string
}

/** Paginated result from `openclaw cron runs` */
export interface OpenClawCronRunsResult {
  entries: OpenClawCronRun[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  nextOffset: number
}

/** Aggregated OpenClaw data exposed to DashboardService */
export interface OpenClawData {
  overview: OpenClawStatusOverview
  sessions: OpenClawSession[]
  channels: OpenClawChannel[]
  security: { summary: string }
  cronJobs: OpenClawCronJob[]
  cronRuns: Record<string, OpenClawCronRun[]>   // jobId → recent runs
  fetchedAt: string                              // ISO timestamp
}
