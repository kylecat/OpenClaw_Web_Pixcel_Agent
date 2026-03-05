import { Controller, Get, Param, Query } from '@nestjs/common';
import { ShelfService } from './shelf.service.js';
import type { FileEntry, FileContent } from './shelf.service.js';

@Controller('shelf')
export class ShelfController {
  constructor(private readonly shelfService: ShelfService) {}

  /** List files in a root directory, optionally under a sub-path. */
  @Get(':rootKey')
  listFiles(
    @Param('rootKey') rootKey: string,
    @Query('sub') sub?: string,
  ): Promise<FileEntry[]> {
    return this.shelfService.listFiles(rootKey, sub);
  }

  /** Read a single file's content for preview. */
  @Get(':rootKey/file')
  readFile(
    @Param('rootKey') rootKey: string,
    @Query('path') filePath: string,
  ): Promise<FileContent> {
    return this.shelfService.readFileContent(rootKey, filePath);
  }
}
