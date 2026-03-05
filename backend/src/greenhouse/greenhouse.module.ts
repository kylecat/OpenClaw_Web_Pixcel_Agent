import { Module } from '@nestjs/common'
import { GreenhouseController } from './greenhouse.controller.js'
import { GreenhouseService } from './greenhouse.service.js'

@Module({
  controllers: [GreenhouseController],
  providers: [GreenhouseService],
  exports: [GreenhouseService],
})
export class GreenhouseModule {}
