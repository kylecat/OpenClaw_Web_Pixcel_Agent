import { Injectable } from '@nestjs/common'
import * as os from 'os'
import { AgentsService } from '../agents/agents.service.js'
import { OpenClawService } from '../openclaw/openclaw.service.js'
import type {
  DashboardSummary,
  GatewayStatus,
  AgentOverview,
  HostMetrics,
  OpenClawInfo,
} from './dto/dashboard-summary.dto.js'

@Injectable()
export class DashboardService {
  private readonly startTime = Date.now()

  constructor(
    private readonly agentsService: AgentsService,
    private readonly openclawService: OpenClawService,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const [gateway, agents, host] = await Promise.all([
      this.getGatewayStatus(),
      this.getAgentOverviews(),
      this.getHostMetrics(),
    ])

    return {
      gateway,
      agents,
      host,
      openclaw: this.getOpenClawInfo(),
      lastUpdated: new Date().toISOString(),
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Gateway — derived from OpenClaw status when available            */
  /* ---------------------------------------------------------------- */

  private async getGatewayStatus(): Promise<GatewayStatus> {
    const oc = this.openclawService.getData()
    if (oc?.overview?.gateway) {
      // Parse gateway string: e.g. "local · ws://... · reachable 195ms · ..."
      const gw = oc.overview.gateway
      const isReachable = gw.includes('reachable')
      const version = oc.overview.update?.match(/latest\s+([\d.]+)/)?.[1] ?? '0.0.0'
      const serviceStr = oc.overview.gatewayService ?? ''
      const isRunning = serviceStr.includes('running')

      return {
        status: isReachable && isRunning ? 'online' : isReachable ? 'degraded' : 'offline',
        version,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        lastCheck: oc.fetchedAt,
      }
    }

    // Fallback to mock if OpenClaw data not yet available
    return {
      status: 'online',
      version: '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      lastCheck: new Date().toISOString(),
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Agents — real status + token data from OpenClaw sessions         */
  /* ---------------------------------------------------------------- */

  /** Map PixelAgent agent IDs to OpenClaw session key segments */
  private static readonly AGENT_SESSION_KEY: Record<string, string> = {
    gaia: 'agent:main:main',
    astraea: 'agent:astraea:main',
  }

  private async getAgentOverviews(): Promise<AgentOverview[]> {
    const agents = this.agentsService.findAll()
    const oc = this.openclawService.getData()

    return agents.map((a) => {
      // Match by explicit key mapping, falling back to id-based search
      const expectedKey = DashboardService.AGENT_SESSION_KEY[a.id]
      const session = oc?.sessions?.find(
        s => expectedKey ? s.key === expectedKey
                         : (s.key.includes(a.id) && !s.key.includes('cron')),
      )
      const model = session?.model ?? a.model
      const tokenUsage = this.parseTokenUsage(session?.tokens)

      return {
        id: a.id,
        displayName: a.displayName,
        status: a.status,
        emoji: a.emoji,
        model,
        tokenUsage,
      }
    })
  }

  /** Parse token string like "56k/272k (20%) · 🗄️ 296% cached" */
  private parseTokenUsage(tokens?: string): { today: number; total: number } {
    if (!tokens) {
      return { today: 0, total: 0 }
    }
    const match = tokens.match(/([\d.]+)k\/([\d.]+)k/)
    if (match) {
      return {
        today: Math.round(parseFloat(match[1]) * 1000),
        total: Math.round(parseFloat(match[2]) * 1000),
      }
    }
    return { today: 0, total: 0 }
  }

  /* ---------------------------------------------------------------- */
  /*  OpenClaw — structured data from polling service                  */
  /* ---------------------------------------------------------------- */

  private getOpenClawInfo(): OpenClawInfo | null {
    const oc = this.openclawService.getData()
    if (!oc) return null

    return {
      sessions: oc.sessions.map(s => ({
        key: s.key,
        kind: s.kind,
        age: s.age,
        model: s.model,
        tokens: s.tokens,
      })),
      cronJobs: oc.cronJobs.map(j => ({
        id: j.id,
        name: j.name,
        schedule: j.schedule,
        next: j.next,
        last: j.last,
        status: j.status,
        target: j.target,
        agentId: j.agentId,
        model: j.model,
      })),
      cronRuns: Object.fromEntries(
        Object.entries(oc.cronRuns).map(([jobId, runs]) => [
          jobId,
          runs.map(r => ({
            ts: r.ts,
            status: r.status,
            summary: r.summary,
            error: r.error,
            durationMs: r.durationMs,
            model: r.model,
            provider: r.provider,
            usage: r.usage,
            deliveryStatus: r.deliveryStatus,
          })),
        ]),
      ),
      channels: oc.channels.map(c => ({
        channel: c.channel,
        enabled: c.enabled,
        state: c.state,
        detail: c.detail,
      })),
      security: oc.security,
      fetchedAt: oc.fetchedAt,
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Host — real CPU / RAM via Node.js os module                     */
  /* ---------------------------------------------------------------- */

  private async getHostMetrics(): Promise<HostMetrics> {
    const cpus = os.cpus()
    const cpuUsage = this.calcCpuUsage(cpus)
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuUsage: Math.round(cpuUsage * 10) / 10,
      memTotal: Math.round(totalMem / 1024 / 1024),
      memUsed: Math.round(usedMem / 1024 / 1024),
      memUsage: Math.round((usedMem / totalMem) * 1000) / 10,
      uptime: Math.floor(os.uptime()),
    }
  }

  private calcCpuUsage(cpus: os.CpuInfo[]): number {
    let totalIdle = 0
    let totalTick = 0
    for (const cpu of cpus) {
      const { user, nice, sys, idle, irq } = cpu.times
      totalTick += user + nice + sys + idle + irq
      totalIdle += idle
    }
    return ((1 - totalIdle / totalTick) * 100)
  }
}
