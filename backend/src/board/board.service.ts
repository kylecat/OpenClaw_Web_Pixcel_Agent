import { Injectable, NotFoundException } from '@nestjs/common'
import { join } from 'node:path'
import { readdir, writeFile, unlink, rename } from 'node:fs/promises'
import { mkdirSync, existsSync } from 'node:fs'
import {
  parseRecord, serializeRecord, parseSections,
  readTextFile, ensureDir, WriteLock,
  type RawRecord,
} from '../common/utils/markdown-store.js'
import { TaskStatus } from '../common/enums/task-status.enum.js'
import { AlertLevel, AlertSource } from '../common/enums/alert-level.enum.js'
import type { CreateTaskDto } from './dto/create-task.dto.js'
import type { UpdateTaskDto } from './dto/update-task.dto.js'
import type { CreateAlertDto } from './dto/create-alert.dto.js'
import type { UpdateAlertDto } from './dto/update-alert.dto.js'

/* ------------------------------------------------------------------ */
/*  Domain interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface TaskItem {
  id: string
  title: string
  assignee: string
  status: string
  priority: string
  created: string
  content: string
}

export interface AlertItem {
  id: string
  title: string
  level: string
  source: string
  created: string
  acknowledged: boolean
  content: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DATA_DIR = join(process.cwd(), '..', 'data')
const TASKS_DIR = join(DATA_DIR, 'tasks')
const ALERTS_DIR = join(DATA_DIR, 'alerts')

function taskFromRaw(r: RawRecord): TaskItem {
  return {
    id: r.id,
    title: r.title,
    assignee: r.meta['assignee'] ?? 'unassigned',
    status: r.meta['status'] ?? TaskStatus.TODO,
    priority: r.meta['priority'] ?? 'P1',
    created: r.meta['created'] ?? new Date().toISOString(),
    content: r.body,
  }
}

function taskToRaw(t: TaskItem): RawRecord {
  return {
    id: t.id,
    title: t.title,
    meta: {
      assignee: t.assignee,
      status: t.status,
      priority: t.priority,
      created: t.created,
    },
    body: t.content,
  }
}

/** ISO week string: "YYYY-Www" */
function getISOWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function nextId(existingIds: string[], prefix: string): string {
  let max = 0
  for (const id of existingIds) {
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`))
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

/* ------------------------------------------------------------------ */
/*  Alert weekly file parser / serializer                              */
/* ------------------------------------------------------------------ */

interface AlertWeeklyFile {
  week: string
  alerts: AlertItem[]
}

function parseAlertWeeklyFile(text: string, week: string): AlertItem[] {
  const alerts: AlertItem[] = []
  const lines = text.split('\n')

  // Find table rows (skip header + separator)
  let tableStart = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|') && lines[i].includes('---')) {
      tableStart = i + 1
      break
    }
  }

  if (tableStart === -1) return []

  // Parse table rows
  for (let i = tableStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) break
    const cells = line.split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length < 6) continue

    const [id, title, level, source, created, ack] = cells
    alerts.push({
      id, title, level, source, created,
      acknowledged: ack === 'yes',
      content: '',
    })
  }

  // Parse content blocks: <!-- ID --> followed by > blockquote lines
  for (const alert of alerts) {
    const marker = `<!-- ${alert.id} -->`
    const markerIdx = text.indexOf(marker)
    if (markerIdx === -1) continue

    const afterMarker = text.slice(markerIdx + marker.length)
    const contentLines: string[] = []
    for (const line of afterMarker.split('\n')) {
      if (line.startsWith('> ')) {
        contentLines.push(line.slice(2))
      } else if (line.trim() === '>' || line.trim() === '') {
        if (contentLines.length > 0) break
      } else if (contentLines.length > 0) {
        break
      }
    }
    alert.content = contentLines.join('\n').trim()
  }

  return alerts
}

function serializeAlertWeeklyFile(week: string, alerts: AlertItem[]): string {
  let out = `# Alerts — ${week}\n\n`
  out += '| ID | Title | Level | Source | Created | Ack |\n'
  out += '|---|---|---|---|---|---|\n'

  for (const a of alerts) {
    const created = a.created.length > 16 ? a.created.slice(0, 16).replace('T', ' ') : a.created
    out += `| ${a.id} | ${a.title} | ${a.level} | ${a.source} | ${created} | ${a.acknowledged ? 'yes' : 'no'} |\n`
  }

  // Content blocks
  for (const a of alerts) {
    if (!a.content) continue
    out += `\n<!-- ${a.id} -->\n`
    for (const line of a.content.split('\n')) {
      out += `> ${line}\n`
    }
  }

  return out
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class BoardService {
  private readonly taskLock = new WriteLock()
  private readonly alertLock = new WriteLock()

  constructor() {
    mkdirSync(TASKS_DIR, { recursive: true })
    mkdirSync(ALERTS_DIR, { recursive: true })
    // Migrate legacy files (fire-and-forget)
    this.migrateLegacyTasks().catch(e => console.warn('[BoardService] task migration failed:', e))
    this.migrateLegacyAlerts().catch(e => console.warn('[BoardService] alert migration failed:', e))
  }

  /* ================================================================ */
  /*  Tasks — one file per task in data/tasks/                         */
  /* ================================================================ */

  async findAllTasks(): Promise<TaskItem[]> {
    const files = await this.taskFiles()
    const tasks: TaskItem[] = []
    for (const f of files) {
      const text = await readTextFile(join(TASKS_DIR, f))
      if (!text) continue
      const raw = parseRecord(text)
      if (raw) tasks.push(taskFromRaw(raw))
    }
    return tasks
  }

  async findOneTask(id: string): Promise<TaskItem> {
    const text = await readTextFile(join(TASKS_DIR, `${id}.md`))
    if (!text) throw new NotFoundException(`Task "${id}" not found`)
    const raw = parseRecord(text)
    if (!raw) throw new NotFoundException(`Task "${id}" could not be parsed`)
    return taskFromRaw(raw)
  }

  async createTask(dto: CreateTaskDto): Promise<TaskItem> {
    return this.taskLock.run(async () => {
      const files = await this.taskFiles()
      const ids = files.map(f => f.replace('.md', ''))
      const id = nextId(ids, 'TASK')
      const task: TaskItem = {
        id,
        title: dto.title,
        assignee: dto.assignee ?? 'unassigned',
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? 'P1',
        created: new Date().toISOString(),
        content: dto.content ?? '',
      }
      await writeFile(join(TASKS_DIR, `${id}.md`), serializeRecord(taskToRaw(task)), 'utf-8')
      return task
    })
  }

  async updateTask(id: string, dto: UpdateTaskDto): Promise<TaskItem> {
    return this.taskLock.run(async () => {
      const task = await this.findOneTask(id)
      if (dto.title !== undefined) task.title = dto.title
      if (dto.assignee !== undefined) task.assignee = dto.assignee
      if (dto.status !== undefined) task.status = dto.status
      if (dto.priority !== undefined) task.priority = dto.priority
      if (dto.content !== undefined) task.content = dto.content
      await writeFile(join(TASKS_DIR, `${id}.md`), serializeRecord(taskToRaw(task)), 'utf-8')
      return task
    })
  }

  async deleteTask(id: string): Promise<void> {
    return this.taskLock.run(async () => {
      const filePath = join(TASKS_DIR, `${id}.md`)
      const text = await readTextFile(filePath)
      if (!text) throw new NotFoundException(`Task "${id}" not found`)
      await unlink(filePath)
    })
  }

  private async taskFiles(): Promise<string[]> {
    try {
      const entries = await readdir(TASKS_DIR)
      return entries.filter(f => f.endsWith('.md')).sort()
    } catch {
      return []
    }
  }

  /* ================================================================ */
  /*  Alerts — weekly table files in data/alerts/                      */
  /* ================================================================ */

  async findAllAlerts(week?: string): Promise<AlertItem[]> {
    const target = week ?? getISOWeekString(new Date())
    const text = await readTextFile(join(ALERTS_DIR, `${target}.md`))
    if (!text) return []
    return parseAlertWeeklyFile(text, target)
  }

  async findOneAlert(id: string): Promise<AlertItem> {
    const { alert } = await this.findAlertInFiles(id)
    return alert
  }

  async createAlert(dto: CreateAlertDto): Promise<AlertItem> {
    return this.alertLock.run(async () => {
      const week = getISOWeekString(new Date())
      const filePath = join(ALERTS_DIR, `${week}.md`)

      // Read existing or create new
      let alerts: AlertItem[] = []
      const text = await readTextFile(filePath)
      if (text) alerts = parseAlertWeeklyFile(text, week)

      // Also scan all files for global max ID
      const allIds = await this.allAlertIds()
      const id = nextId(allIds, 'ALERT')

      const alert: AlertItem = {
        id,
        title: dto.title,
        level: dto.level ?? AlertLevel.INFO,
        source: dto.source ?? AlertSource.MANUAL,
        created: new Date().toISOString(),
        acknowledged: false,
        content: dto.content ?? '',
      }
      alerts.push(alert)

      await ensureDir(ALERTS_DIR)
      await writeFile(filePath, serializeAlertWeeklyFile(week, alerts), 'utf-8')
      return alert
    })
  }

  async updateAlert(id: string, dto: UpdateAlertDto): Promise<AlertItem> {
    return this.alertLock.run(async () => {
      const { alert, week, alerts } = await this.findAlertInFiles(id)
      if (dto.acknowledged !== undefined) alert.acknowledged = dto.acknowledged
      const filePath = join(ALERTS_DIR, `${week}.md`)
      await writeFile(filePath, serializeAlertWeeklyFile(week, alerts), 'utf-8')
      return alert
    })
  }

  async deleteAlert(id: string): Promise<void> {
    return this.alertLock.run(async () => {
      const { week, alerts } = await this.findAlertInFiles(id)
      const idx = alerts.findIndex(a => a.id === id)
      alerts.splice(idx, 1)
      const filePath = join(ALERTS_DIR, `${week}.md`)
      if (alerts.length === 0) {
        await unlink(filePath)
      } else {
        await writeFile(filePath, serializeAlertWeeklyFile(week, alerts), 'utf-8')
      }
    })
  }

  /** Scan all weekly files to find an alert by ID */
  private async findAlertInFiles(id: string): Promise<{ alert: AlertItem; week: string; alerts: AlertItem[] }> {
    const files = await this.alertFiles()
    for (const f of files) {
      const week = f.replace('.md', '')
      const text = await readTextFile(join(ALERTS_DIR, f))
      if (!text) continue
      const alerts = parseAlertWeeklyFile(text, week)
      const alert = alerts.find(a => a.id === id)
      if (alert) return { alert, week, alerts }
    }
    throw new NotFoundException(`Alert "${id}" not found`)
  }

  /** Get all alert IDs across all weekly files */
  private async allAlertIds(): Promise<string[]> {
    const files = await this.alertFiles()
    const ids: string[] = []
    for (const f of files) {
      const week = f.replace('.md', '')
      const text = await readTextFile(join(ALERTS_DIR, f))
      if (!text) continue
      const alerts = parseAlertWeeklyFile(text, week)
      ids.push(...alerts.map(a => a.id))
    }
    return ids
  }

  private async alertFiles(): Promise<string[]> {
    try {
      const entries = await readdir(ALERTS_DIR)
      return entries.filter(f => f.endsWith('.md')).sort()
    } catch {
      return []
    }
  }

  /* ================================================================ */
  /*  Legacy migration                                                 */
  /* ================================================================ */

  private async migrateLegacyTasks(): Promise<void> {
    const legacyPath = join(DATA_DIR, 'tasks.md')
    const text = await readTextFile(legacyPath)
    if (!text) return

    const records = parseSections(text)
    if (records.length === 0) {
      // Empty file, just remove it
      await unlink(legacyPath)
      return
    }

    for (const raw of records) {
      const task = taskFromRaw(raw)
      const filePath = join(TASKS_DIR, `${task.id}.md`)
      if (!existsSync(filePath)) {
        await writeFile(filePath, serializeRecord(taskToRaw(task)), 'utf-8')
      }
    }
    await unlink(legacyPath)
    console.log(`[BoardService] migrated ${records.length} task(s) from tasks.md to individual files`)
  }

  private async migrateLegacyAlerts(): Promise<void> {
    const legacyPath = join(DATA_DIR, 'alerts.md')
    const text = await readTextFile(legacyPath)
    if (!text) return

    const records = parseSections(text)
    if (records.length === 0) {
      await unlink(legacyPath)
      return
    }

    // Group alerts by week based on their created date
    const weekMap = new Map<string, AlertItem[]>()
    for (const raw of records) {
      const alert: AlertItem = {
        id: raw.id,
        title: raw.title,
        level: raw.meta['level'] ?? AlertLevel.INFO,
        source: raw.meta['source'] ?? AlertSource.MANUAL,
        created: raw.meta['created'] ?? new Date().toISOString(),
        acknowledged: raw.meta['acknowledged'] === 'true',
        content: raw.body,
      }
      const week = getISOWeekString(new Date(alert.created))
      if (!weekMap.has(week)) weekMap.set(week, [])
      weekMap.get(week)!.push(alert)
    }

    for (const [week, alerts] of weekMap) {
      const filePath = join(ALERTS_DIR, `${week}.md`)
      if (!existsSync(filePath)) {
        await writeFile(filePath, serializeAlertWeeklyFile(week, alerts), 'utf-8')
      }
    }
    await unlink(legacyPath)
    console.log(`[BoardService] migrated ${records.length} alert(s) from alerts.md to weekly files`)
  }
}
