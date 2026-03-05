import { Module } from '@nestjs/common';
import { ShelfController } from './shelf.controller.js';
import { ShelfService } from './shelf.service.js';

@Module({
  controllers: [ShelfController],
  providers: [ShelfService],
})
export class ShelfModule {}
