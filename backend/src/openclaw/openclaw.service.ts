/* ------------------------------------------------------------------ */
/*  OpenClawService — polls CLI commands, caches structured results     */
/* ------------------------------------------------------------------ */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { exec } from 'child_process'
import { promisify } from 'util'
import { parseStatus, parseCronList, parseCronRuns } from './openclaw.parser.js'
import type {
  OpenClawData,
  OpenClawCronJob,
  OpenClawCronRun,
} from './openclaw.dto.js'
import { EventsGateway } from '../events/events.gateway.js'

const execAsync = promisify(exec)

/** Polling interval in ms (60 seconds) */
const POLL_INTERVAL = 60_000

/** Max runs to fetch per cron job */
const CRON_RUNS_LIMIT = 5

/** CLI execution timeout in ms */
const EXEC_TIMEOUT = 30_000

@Injectable()
export class OpenClawService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenClawService.name)
  private timer: ReturnType<typeof setInterval> | null = null
  private cached: OpenClawData | null = null

  constructor(private readonly events: EventsGateway) {}

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  async onModuleInit() {
    this.logger.log('Initialising OpenClaw polling (interval: 60s)')
    // First fetch immediately
    await this.poll()
    // Then schedule periodic polling
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL)
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Public API                                                       */
  /* ---------------------------------------------------------------- */

  /** Returns the latest cached OpenClaw data (or null before first poll) */
  getData(): OpenClawData | null {
    return this.cached
  }

  /* ---------------------------------------------------------------- */
  /*  Internal: CLI execution                                          */
  /* ---------------------------------------------------------------- */

  private async runCli(cmd: string): Promise<string> {
    try {
      const { stdout } = await execAsync(cmd, {
        timeout: EXEC_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,   // 10 MB — cron runs can be large
        env: { ...process.env, NO_COLOR: '1' },
      })
      return stdout
    } catch (err) {
      // exec rejects on non-zero exit, but often still has useful stdout
      if (err && typeof err === 'object' && 'stdout' in err) {
        const stdout = (err as { stdout: string }).stdout
        if (stdout) return stdout
      }
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`CLI command failed: ${cmd} — ${msg}`)
      return ''
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Internal: poll cycle                                             */
  /* ---------------------------------------------------------------- */

  private async poll(): Promise<void> {
    try {
      // 1) openclaw status
      const statusRaw = await this.runCli('openclaw status')
      const status = statusRaw ? parseStatus(statusRaw) : null

      // 2) openclaw cron list
      const cronListRaw = await this.runCli('openclaw cron list')
      const cronJobs: OpenClawCronJob[] = cronListRaw ? parseCronList(cronListRaw) : []

      // 3) openclaw cron runs for each job
      const cronRuns: Record<string, OpenClawCronRun[]> = {}
      for (const job of cronJobs) {
        const runsRaw = await this.runCli(
          `openclaw cron runs --id ${job.id} --limit ${CRON_RUNS_LIMIT}`,
        )
        if (runsRaw) {
          const parsed = parseCronRuns(runsRaw)
          cronRuns[job.id] = parsed.entries
        }
      }

      this.cached = {
        overview: status?.overview ?? {} as OpenClawData['overview'],
        sessions: status?.sessions ?? [],
        channels: status?.channels ?? [],
        security: status?.security ?? { summary: '' },
        cronJobs,
        cronRuns,
        fetchedAt: new Date().toISOString(),
      }

      this.logger.log(
        `Poll OK — ${this.cached.sessions.length} sessions, ` +
        `${cronJobs.length} cron jobs`,
      )

      // Notify all connected clients that dashboard data is stale
      this.events.emitDashboardStale()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Poll cycle failed: ${msg}`)
    }
  }
}
