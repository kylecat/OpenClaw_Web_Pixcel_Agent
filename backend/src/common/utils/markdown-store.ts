import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

/* ------------------------------------------------------------------ */
/*  Raw record: the intermediate representation between MD and domain  */
/* ------------------------------------------------------------------ */

export interface RawRecord {
  id: string
  title: string
  meta: Record<string, string>
  body: string
}

/* ------------------------------------------------------------------ */
/*  Standalone parse / serialize helpers (used by file-per-item stores) */
/* ------------------------------------------------------------------ */

/**
 * Parse a single-record markdown file.
 * Expects: `# ID | Title` (or `## ID | Title`), followed by `- key: value` meta lines,
 * then an optional blank line and body text.
 */
export function parseRecord(text: string): RawRecord | null {
  const trimmed = text.trim()
  // Match heading level 1 or 2
  const headingMatch = trimmed.match(/^#{1,2}\s+(.+)/)
  if (!headingMatch) return null

  const heading = headingMatch[1]
  const pipeIdx = heading.indexOf(' | ')
  if (pipeIdx === -1) return null

  const id = heading.slice(0, pipeIdx).trim()
  const title = heading.slice(pipeIdx + 3).trim()

  const lines = trimmed.split('\n')
  const meta: Record<string, string> = {}
  let bodyStart = lines.length

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const metaMatch = line.match(/^- (\w[\w\s]*?):\s*(.*)$/)
    if (metaMatch) {
      meta[metaMatch[1].trim()] = metaMatch[2].trim()
    } else if (line.trim() === '') {
      bodyStart = i + 1
      break
    } else {
      bodyStart = i
      break
    }
  }

  const body = lines.slice(bodyStart).join('\n').trim()
  return { id, title, meta, body }
}

/**
 * Serialize a single record as a standalone markdown file.
 * Uses `# ID | Title` (level-1 heading).
 */
export function serializeRecord(r: RawRecord): string {
  let out = `# ${r.id} | ${r.title}\n`
  for (const [key, value] of Object.entries(r.meta)) {
    out += `- ${key}: ${value}\n`
  }
  if (r.body) {
    out += `\n${r.body}\n`
  }
  return out
}

/**
 * Parse multi-record markdown text (sections separated by `## ` headings).
 */
export function parseSections(text: string): RawRecord[] {
  const sections = text.split(/\n(?=## )/)
  const records: RawRecord[] = []

  for (const section of sections) {
    const trimmed = section.trim()
    if (!trimmed.startsWith('## ')) continue

    const lines = trimmed.split('\n')
    const heading = lines[0].replace(/^## /, '')

    const pipeIdx = heading.indexOf(' | ')
    if (pipeIdx === -1) {
      console.warn(`[markdown-store] skipping section with no pipe separator: "${heading}"`)
      continue
    }

    const id = heading.slice(0, pipeIdx).trim()
    const title = heading.slice(pipeIdx + 3).trim()

    const meta: Record<string, string> = {}
    let bodyStart = lines.length

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const metaMatch = line.match(/^- (\w[\w\s]*?):\s*(.*)$/)
      if (metaMatch) {
        meta[metaMatch[1].trim()] = metaMatch[2].trim()
      } else if (line.trim() === '') {
        bodyStart = i + 1
        break
      } else {
        bodyStart = i
        break
      }
    }

    const body = lines.slice(bodyStart).join('\n').trim()
    records.push({ id, title, meta, body })
  }

  return records
}

/* ------------------------------------------------------------------ */
/*  File I/O helpers                                                   */
/* ------------------------------------------------------------------ */

export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

/* ------------------------------------------------------------------ */
/*  WriteLock — reusable in-process mutex                              */
/* ------------------------------------------------------------------ */

export class WriteLock {
  private chain: Promise<void> = Promise.resolve()

  async run<R>(fn: () => Promise<R>): Promise<R> {
    let release!: () => void
    const next = new Promise<void>(r => { release = r })
    const prev = this.chain
    this.chain = next
    await prev
    try {
      return await fn()
    } finally {
      release()
    }
  }
}

/* ------------------------------------------------------------------ */
/*  MarkdownStore — generic multi-record MD-file store (kept for compat) */
/* ------------------------------------------------------------------ */

export class MarkdownStore<T> {
  private lock = new WriteLock()

  constructor(
    private readonly filePath: string,
    private readonly headerLine: string,
    private readonly fromRaw: (raw: RawRecord) => T,
    private readonly toRaw: (item: T) => RawRecord,
  ) {}

  async readAll(): Promise<T[]> {
    const text = await readTextFile(this.filePath)
    if (!text) return []
    return parseSections(text).map(this.fromRaw)
  }

  async writeAll(items: T[]): Promise<void> {
    await this.lock.run(async () => {
      let out = this.headerLine + '\n'
      for (const r of items.map(this.toRaw)) {
        out += `\n## ${r.id} | ${r.title}\n`
        for (const [key, value] of Object.entries(r.meta)) {
          out += `- ${key}: ${value}\n`
        }
        if (r.body) {
          out += `\n${r.body}\n`
        }
      }
      await ensureDir(dirname(this.filePath))
      await writeFile(this.filePath, out, 'utf-8')
    })
  }
}
