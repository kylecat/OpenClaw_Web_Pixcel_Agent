import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { BoardService } from './board.service.js'
import type { TaskItem, AlertItem } from './board.service.js'
import { CreateTaskDto } from './dto/create-task.dto.js'
import { UpdateTaskDto } from './dto/update-task.dto.js'
import { CreateAlertDto } from './dto/create-alert.dto.js'
import { UpdateAlertDto } from './dto/update-alert.dto.js'
import { EventsGateway } from '../events/events.gateway.js'

@Controller('board')
export class BoardController {
  constructor(
    private readonly boardService: BoardService,
    private readonly events: EventsGateway,
  ) {}

  /* ---------- Tasks ---------- */

  @Get('tasks')
  findAllTasks(): Promise<TaskItem[]> {
    return this.boardService.findAllTasks()
  }

  @Get('tasks/:id')
  findOneTask(@Param('id') id: string): Promise<TaskItem> {
    return this.boardService.findOneTask(id)
  }

  @Post('tasks')
  async createTask(@Body() dto: CreateTaskDto): Promise<TaskItem> {
    const task = await this.boardService.createTask(dto)
    this.events.emitBoardChanged()
    return task
  }

  @Patch('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskItem> {
    const task = await this.boardService.updateTask(id, dto)
    this.events.emitBoardChanged()
    return task
  }

  @Delete('tasks/:id')
  async deleteTask(@Param('id') id: string): Promise<void> {
    await this.boardService.deleteTask(id)
    this.events.emitBoardChanged()
  }

  /* ---------- Alerts ---------- */

  @Get('alerts')
  findAllAlerts(@Query('week') week?: string): Promise<AlertItem[]> {
    return this.boardService.findAllAlerts(week)
  }

  @Get('alerts/:id')
  findOneAlert(@Param('id') id: string): Promise<AlertItem> {
    return this.boardService.findOneAlert(id)
  }

  @Post('alerts')
  async createAlert(@Body() dto: CreateAlertDto): Promise<AlertItem> {
    const alert = await this.boardService.createAlert(dto)
    this.events.emitBoardChanged()
    return alert
  }

  @Patch('alerts/:id')
  async updateAlert(
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ): Promise<AlertItem> {
    const alert = await this.boardService.updateAlert(id, dto)
    this.events.emitBoardChanged()
    return alert
  }

  @Delete('alerts/:id')
  async deleteAlert(@Param('id') id: string): Promise<void> {
    await this.boardService.deleteAlert(id)
    this.events.emitBoardChanged()
  }
}
