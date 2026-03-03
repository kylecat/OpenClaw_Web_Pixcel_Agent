import { Body, Controller, Get, Param, Patch } from '@nestjs/common'
import { AgentsService } from './agents.service.js'
import type { Agent } from './agents.service.js'
import { UpdateAgentStatusDto } from './dto/update-agent-status.dto.js'
import { EventsGateway } from '../events/events.gateway.js'

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly events: EventsGateway,
  ) {}

  @Get()
  findAll(): Agent[] {
    return this.agentsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string): Agent {
    return this.agentsService.findOne(id)
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAgentStatusDto,
  ): Agent {
    const updated = this.agentsService.updateStatus(id, dto.status)
    this.events.emitAgentStatus(updated)
    return updated
  }
}
