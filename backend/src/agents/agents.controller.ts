import { Body, Controller, Get, Param, Patch } from '@nestjs/common'
import { AgentsService } from './agents.service.js'
import type { Agent } from './agents.service.js'
import { UpdateAgentStatusDto } from './dto/update-agent-status.dto.js'

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

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
    return this.agentsService.updateStatus(id, dto.status)
  }
}
