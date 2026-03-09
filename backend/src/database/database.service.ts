import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common'
import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const DB_PATH = join(process.cwd(), 'data', 'openclaw.db')

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  readonly db: Database.Database

  constructor() {
    const dir = join(process.cwd(), 'data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    this.db = new Database(DB_PATH)
    this.db.pragma('journal_mode = WAL')   // better concurrent read performance
    this.db.pragma('busy_timeout = 5000')

    this.initSchema()
    this.logger.log(`SQLite opened: ${DB_PATH}`)
  }

  onModuleDestroy() {
    this.db.close()
    this.logger.log('SQLite closed')
  }

  /* ------------------------------------------------------------------ */
  /*  Schema                                                             */
  /* ------------------------------------------------------------------ */

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS weather_forecast (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        fetched_at  TEXT    NOT NULL,          -- ISO 8601 timestamp of poll
        location    TEXT    NOT NULL,
        time        TEXT    NOT NULL,          -- forecast point datetime
        temp        REAL,
        feels_like  REAL,
        humidity    REAL,
        wind_speed  REAL,
        wind_dir    REAL,
        rain_chance REAL,
        dew_point   REAL,
        vpd         REAL
      );

      CREATE INDEX IF NOT EXISTS idx_wf_location_time
        ON weather_forecast (location, time);

      CREATE INDEX IF NOT EXISTS idx_wf_fetched
        ON weather_forecast (fetched_at);

      CREATE TABLE IF NOT EXISTS weather_observation (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        fetched_at  TEXT    NOT NULL,
        location    TEXT    NOT NULL,
        time        TEXT    NOT NULL,          -- observation datetime
        temp        REAL,
        humidity    REAL,
        wind_speed  REAL,
        wind_dir    REAL,
        pressure    REAL,
        uv_index    REAL,
        vpd         REAL
      );

      CREATE INDEX IF NOT EXISTS idx_wo_location_time
        ON weather_observation (location, time);
    `)
  }
}
