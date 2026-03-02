import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { BoardService } from './board.service.js'
import type { TaskItem, AlertItem } from './board.service.js'
import { CreateTaskDto } from './dto/create-task.dto.js'
import { UpdateTaskDto } from './dto/update-task.dto.js'
import { CreateAlertDto } from './dto/create-alert.dto.js'
import { UpdateAlertDto } from './dto/update-alert.dto.js'

@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

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
  createTask(@Body() dto: CreateTaskDto): Promise<TaskItem> {
    return this.boardService.createTask(dto)
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskItem> {
    return this.boardService.updateTask(id, dto)
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string): Promise<void> {
    return this.boardService.deleteTask(id)
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
  createAlert(@Body() dto: CreateAlertDto): Promise<AlertItem> {
    return this.boardService.createAlert(dto)
  }

  @Patch('alerts/:id')
  updateAlert(
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ): Promise<AlertItem> {
    return this.boardService.updateAlert(id, dto)
  }

  @Delete('alerts/:id')
  deleteAlert(@Param('id') id: string): Promise<void> {
    return this.boardService.deleteAlert(id)
  }
}
