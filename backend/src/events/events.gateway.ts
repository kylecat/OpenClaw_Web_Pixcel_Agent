import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import type { Agent } from '../agents/agents.service.js'
import { AgentsService } from '../agents/agents.service.js'

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway {
  @WebSocketServer()
  server!: Server

  constructor(private readonly agentsService: AgentsService) {}

  /* ---------- Agent events ---------- */

  emitAgentStatus(agent: Agent): void {
    this.server.emit('agent:statusChanged', agent)
  }

  emitAgentWalk(agentId: string, col: number, row: number): void {
    this.server.emit('agent:walk', { agentId, col, row })
  }

  /** Client sends manual walk → broadcast to OTHER clients (sender already walked locally) */
  @SubscribeMessage('agent:walk')
  handleWalk(
    @MessageBody() data: { agentId: string; col: number; row: number },
    @ConnectedSocket() client: Socket,
  ): void {
    this.agentsService.updatePosition(data.agentId, data.col, data.row)
    client.broadcast.emit('agent:walk', data)
  }

  /* ---------- Modal events ---------- */

  @SubscribeMessage('modal:toggled')
  handleModalToggled(
    @MessageBody() data: { modal: 'board' | 'dashboard'; open: boolean },
    @ConnectedSocket() client: Socket,
  ): void {
    client.broadcast.emit('modal:toggled', data)
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
