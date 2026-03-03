import { Module } from '@nestjs/common'
import { OpenClawService } from './openclaw.service.js'

@Module({
  providers: [OpenClawService],
  exports: [OpenClawService],
})
export class OpenClawModule {}
