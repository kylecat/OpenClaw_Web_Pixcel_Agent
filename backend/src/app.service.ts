import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AppService {
  private readonly version: string;

  constructor() {
    try {
      const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf-8');
      this.version = (JSON.parse(raw) as { version: string }).version;
    } catch {
      this.version = '0.0.1';
    }
  }

  getHealth(): { status: string; version: string } {
    return { status: 'ok', version: this.version };
  }
}
