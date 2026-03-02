import { Injectable } from '@nestjs/common'
import * as os from 'os'
import { AgentsService } from '../agents/agents.service.js'
import type {
  DashboardSummary,
  GatewayStatus,
  AgentOverview,
  HostMetrics,
} from './dto/dashboard-summary.dto.js'

@Injectable()
export class DashboardService {
  private readonly startTime = Date.now()

  constructor(private readonly agentsService: AgentsService) {}

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
      lastUpdated: new Date().toISOString(),
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Gateway — Phase 1 mock (replaced by OpenClaw in T7)             */
  /* ---------------------------------------------------------------- */

  private async getGatewayStatus(): Promise<GatewayStatus> {
    return {
      status: 'online',
      version: '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      lastCheck: new Date().toISOString(),
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Agents — real status + mock token data                          */
  /* ---------------------------------------------------------------- */

  private async getAgentOverviews(): Promise<AgentOverview[]> {
    const agents = this.agentsService.findAll()
    return agents.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      status: a.status,
      emoji: a.emoji,
      model: a.model,
      tokenUsage: {
        today: Math.floor(Math.random() * 5000) + 500,
        total: Math.floor(Math.random() * 80000) + 10000,
      },
    }))
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
