import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { GreenhouseService } from './greenhouse.service.js'
import type { PlantEntry, LogEntry } from './greenhouse.service.js'
import type { CreatePlantDto } from './dto/create-plant.dto.js'
import type { UpdatePlantDto } from './dto/update-plant.dto.js'
import { EventsGateway } from '../events/events.gateway.js'

@Controller('greenhouse')
export class GreenhouseController {
  constructor(
    private readonly greenhouse: GreenhouseService,
    private readonly events: EventsGateway,
  ) {}

  @Get()
  findAll(@Query('house') house?: string): Promise<PlantEntry[]> {
    return this.greenhouse.findAll(house != null ? Number(house) : undefined)
  }

  @Post()
  async create(@Body() dto: CreatePlantDto): Promise<PlantEntry> {
    const entry = await this.greenhouse.create(dto)
    this.events.emitGreenhouseChanged()
    return entry
  }

  /* ---------- Cultivation Logs (before :id routes) ---------- */

  @Get('logs')
  findLogs(@Query('house') house: string): Promise<LogEntry[]> {
    return this.greenhouse.findLogs(Number(house) || 0)
  }

  @Post('logs')
  async createLog(@Body() body: { house: number; content: string }): Promise<LogEntry> {
    const entry = await this.greenhouse.createLog(body.house, body.content)
    this.events.emitGreenhouseChanged()
    return entry
  }

  @Delete('logs/:id')
  async removeLog(@Param('id') id: string): Promise<void> {
    await this.greenhouse.removeLog(id)
    this.events.emitGreenhouseChanged()
  }

  /* ---------- Plant CRUD (param routes last) ---------- */

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlantDto,
  ): Promise<PlantEntry> {
    const entry = await this.greenhouse.update(id, dto)
    this.events.emitGreenhouseChanged()
    return entry
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.greenhouse.remove(id)
    this.events.emitGreenhouseChanged()
  }
}
