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
    })
    this.agents.set('astraea', {
      id: 'astraea',
      displayName: 'Astraea',
      status: AgentStatus.IDLE,
      emoji: STATUS_EMOJI[AgentStatus.IDLE],
      model: 'google-gemini-cli/gemini-3-flash-preview',
      lastSeenAt: now,
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
    return agent
  }
}
