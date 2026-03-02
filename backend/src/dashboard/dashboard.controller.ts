import { Controller, Get } from '@nestjs/common'
import { DashboardService } from './dashboard.service.js'
import type { DashboardSummary } from './dto/dashboard-summary.dto.js'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(): Promise<DashboardSummary> {
    return this.dashboardService.getSummary()
  }
}
