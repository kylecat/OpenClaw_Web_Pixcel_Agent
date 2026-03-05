import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { GreenhouseService } from './greenhouse.service.js'
import type { PlantEntry } from './greenhouse.service.js'
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
  findAll(): Promise<PlantEntry[]> {
    return this.greenhouse.findAll()
  }

  @Post()
  async create(@Body() dto: CreatePlantDto): Promise<PlantEntry> {
    const entry = await this.greenhouse.create(dto)
    this.events.emitGreenhouseChanged()
    return entry
  }

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
