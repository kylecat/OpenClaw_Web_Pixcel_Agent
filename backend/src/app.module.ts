import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { BoardModule } from './board/board.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { OpenClawModule } from './openclaw/openclaw.module.js';
import { ShelfModule } from './shelf/shelf.module.js';
import { GreenhouseModule } from './greenhouse/greenhouse.module.js';
import { WeatherModule } from './weather/weather.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [DatabaseModule, EventsModule, AgentsModule, BoardModule, DashboardModule, OpenClawModule, ShelfModule, GreenhouseModule, WeatherModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
