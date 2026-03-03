import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets'
import { Server } from 'socket.io'
import type { Agent } from '../agents/agents.service.js'

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway {
  @WebSocketServer()
  server!: Server

  /* ---------- Agent events ---------- */

  emitAgentStatus(agent: Agent): void {
    this.server.emit('agent:statusChanged', agent)
  }

  emitAgentWalk(agentId: string, col: number, row: number): void {
    this.server.emit('agent:walk', { agentId, col, row })
  }

  /** Client sends manual walk → rebroadcast to all */
  @SubscribeMessage('agent:walk')
  handleWalk(@MessageBody() data: { agentId: string; col: number; row: number }): void {
    this.server.emit('agent:walk', data)
  }

  /* ---------- Board events ---------- */

  emitBoardChanged(): void {
    this.server.emit('board:changed')
  }

  /* ---------- Dashboard events ---------- */

  /** Signal that OpenClaw data has been refreshed; clients should re-fetch */
  emitDashboardStale(): void {
    this.server.emit('dashboard:stale')
  }
}
