import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller.js'
import { DashboardService } from './dashboard.service.js'
import { AgentsModule } from '../agents/agents.module.js'

@Module({
  imports: [AgentsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
