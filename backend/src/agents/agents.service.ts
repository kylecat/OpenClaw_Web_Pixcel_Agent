import { Injectable, NotFoundException } from '@nestjs/common'
import { AgentStatus, STATUS_EMOJI } from '../common/enums/agent-status.enum.js'

export interface Agent {
  id: string
  displayName: string
  status: AgentStatus
  emoji: string
  model: string
  currentTaskId?: string
  lastSeenAt: string
  col: number
  row: number
}

const AGENT_HOME: Record<string, { col: number; row: number }> = {
  gaia:    { col: 6,  row: 6 },
  astraea: { col: 18, row: 5 },
}

const STATUS_TARGET: Record<string, { col: number; row: number }> = {
  THINKING:         { col: 3,  row: 2 },
  TALKING:          { col: 3,  row: 2 },
  ERROR:            { col: 11, row: 2 },
  CRASHED:          { col: 11, row: 2 },
  NETWORK_UNSTABLE: { col: 11, row: 2 },
}

@Injectable()
export class AgentsService {
  private readonly agents: Map<string, Agent> = new Map()

  constructor() {
    const now = new Date().toISOString()
    this.agents.set('gaia', {
      id: 'gaia',
      displayName: 'Gaia',
      status: AgentStatus.IDLE,
      emoji: STATUS_EMOJI[AgentStatus.IDLE],
      model: 'gpt-5.3-codex',
      lastSeenAt: now,
      col: 6,
      row: 6,
    })
    this.agents.set('astraea', {
      id: 'astraea',
      displayName: 'Astraea',
      status: AgentStatus.IDLE,
      emoji: STATUS_EMOJI[AgentStatus.IDLE],
      model: 'google-gemini-cli/gemini-3-flash-preview',
      lastSeenAt: now,
      col: 18,
      row: 5,
    })
  }

  findAll(): Agent[] {
    return Array.from(this.agents.values())
  }

  findOne(id: string): Agent {
    const agent = this.agents.get(id)
    if (!agent) throw new NotFoundException(`Agent "${id}" not found`)
    return agent
  }

  updateStatus(id: string, status: AgentStatus): Agent {
    const agent = this.findOne(id)
    agent.status = status
    agent.emoji = STATUS_EMOJI[status]
    agent.lastSeenAt = new Date().toISOString()
    const target = STATUS_TARGET[status] ?? AGENT_HOME[id] ?? { col: 0, row: 0 }
    agent.col = target.col
    agent.row = target.row
    return agent
  }

  updatePosition(id: string, col: number, row: number): void {
    const agent = this.agents.get(id)
    if (agent) {
      agent.col = col
      agent.row = row
    }
  }
}
