import { Global, Module } from '@nestjs/common'
import { EventsGateway } from './events.gateway.js'
import { AgentsModule } from '../agents/agents.module.js'

@Global()
@Module({
  imports: [AgentsModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
