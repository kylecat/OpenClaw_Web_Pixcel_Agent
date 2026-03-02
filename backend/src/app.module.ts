import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentsModule } from './agents/agents.module.js';
import { BoardModule } from './board/board.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';

@Module({
  imports: [AgentsModule, BoardModule, DashboardModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
