/* ------------------------------------------------------------------ */
/*  OpenClaw CLI output parsers                                        */
/*  - parseStatus : `openclaw status` (box-drawing tables)             */
/*  - parseCronList : `openclaw cron list` (column-aligned table)      */
/*  - parseCronRuns : `openclaw cron runs` (JSON)                      */
/* ------------------------------------------------------------------ */

import type {
  OpenClawStatus,
  OpenClawStatusOverview,
  OpenClawSession,
  OpenClawChannel,
  OpenClawCronJob,
  OpenClawCronRunsResult,
} from './openclaw.dto.js'

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Strip ANSI escape codes */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
}

/**
 * Parse a box-drawing table (─ ┌ ┐ ├ ┤ └ ┘ │) into rows of cells.
 * Only data rows (containing │ separators but NOT ─/═) are returned.
 */
function parseBoxTable(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split('\n')) {
    const trimmed = stripAnsi(line).trim()
    // skip border rows
    if (!trimmed.startsWith('│')) continue
    if (/^[─┌┐├┤└┘┬┴┼═╔╗╚╝╠╣╦╩╬]+$/.test(trimmed)) continue
    // split by │ and trim
    const cells = trimmed
      .split('│')
      .map(c => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length) // drop first/last empty
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

/**
 * Given rows from parseBoxTable, if the first row looks like a header,
 * return { header, data } split.
 */
function splitHeaderData(rows: string[][]): { header: string[]; data: string[][] } {
  if (rows.length === 0) return { header: [], data: [] }
  return { header: rows[0], data: rows.slice(1) }
}

/* ================================================================== */
/*  parseStatus                                                        */
/* ================================================================== */

const OVERVIEW_KEY_MAP: Record<string, keyof OpenClawStatusOverview> = {
  'dashboard': 'dashboard',
  'os': 'os',
  'tailscale': 'tailscale',
  'channel': 'channel',
  'update': 'update',
  'gateway': 'gateway',
  'gateway service': 'gatewayService',
  'node service': 'nodeService',
  'agents': 'agents',
  'memory': 'memory',
  'probes': 'memory',          // fallback — unlikely conflict
  'events': 'memory',          // fallback
  'heartbeat': 'heartbeat',
  'sessions': 'sessions',
}

export function parseStatus(raw: string): OpenClawStatus {
  const text = stripAnsi(raw)

  // --- Find named sections by scanning for section headers ---
  const overviewRows = extractSection(text, 'Overview')
  const securitySummary = extractSecuritySummary(text)
  const channelRows = extractSection(text, 'Channels')
  const sessionRows = extractSection(text, 'Sessions')

  // --- Overview ---
  const overview = {} as OpenClawStatusOverview
  for (const row of overviewRows) {
    if (row.length < 2) continue
    const key = row[0].toLowerCase().trim()
    const val = row.slice(1).join(' ').trim()
    const mapped = OVERVIEW_KEY_MAP[key]
    if (mapped) (overview as unknown as Record<string, string>)[mapped] = val
  }

  // --- Sessions ---
  const { data: sessData } = splitHeaderData(sessionRows)
  const sessions: OpenClawSession[] = sessData.map(r => ({
    key: r[0] ?? '',
    kind: r[1] ?? '',
    age: r[2] ?? '',
    model: r[3] ?? '',
    tokens: r[4] ?? '',
  }))

  // --- Channels ---
  const { data: chanData } = splitHeaderData(channelRows)
  const channels: OpenClawChannel[] = chanData.map(r => ({
    channel: r[0] ?? '',
    enabled: r[1] ?? '',
    state: r[2] ?? '',
    detail: r[3] ?? '',
  }))

  return {
    overview,
    sessions,
    channels,
    security: { summary: securitySummary },
  }
}

/** Extract box-table rows that follow a section header line */
function extractSection(text: string, sectionName: string): string[][] {
  // Find the section header
  const lines = text.split('\n')
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase().startsWith(sectionName.toLowerCase())) {
      startIdx = i
      break
    }
  }
  if (startIdx === -1) return []

  // Collect all lines from start until we hit a blank line gap + next section
  const sectionLines: string[] = []
  for (let i = startIdx; i < lines.length; i++) {
    sectionLines.push(lines[i])
    // Stop at next section — line that starts with a capital letter, isn't a table
    if (i > startIdx + 2 && !lines[i].trim().startsWith('│') &&
        !lines[i].trim().startsWith('├') && !lines[i].trim().startsWith('┌') &&
        !lines[i].trim().startsWith('└') && !lines[i].trim().startsWith('─') &&
        lines[i].trim() !== '' && !/^[│├┌└─┬┴┼]/.test(lines[i].trim())) {
      // Check if it looks like a new section header
      if (/^[A-Z]/.test(lines[i].trim())) break
    }
  }

  return parseBoxTable(sectionLines.join('\n'))
}

/** Extract the "Security audit" summary line */
function extractSecuritySummary(text: string): string {
  const match = text.match(/Summary:\s*(.+)/i)
  return match ? match[1].trim() : ''
}

/* ================================================================== */
/*  parseCronList                                                      */
/* ================================================================== */

/**
 * `openclaw cron list` outputs a column-aligned table (space-separated)
 * with a header row. We parse by detecting column positions from the header.
 */
export function parseCronList(raw: string): OpenClawCronJob[] {
  const text = stripAnsi(raw)
  const lines = text.split('\n').filter(l => l.trim() !== '')

  // Find the header line (contains "ID" and "Name" and "Schedule")
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('ID') && trimmed.includes('Name') && trimmed.includes('Schedule')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return []

  const headerLine = lines[headerIdx]
  // Detect column start positions from known header names
  const cols = [
    { name: 'id', start: headerLine.indexOf('ID') },
    { name: 'name', start: headerLine.indexOf('Name') },
    { name: 'schedule', start: headerLine.indexOf('Schedule') },
    { name: 'next', start: headerLine.indexOf('Next') },
    { name: 'last', start: headerLine.indexOf('Last') },
    { name: 'status', start: headerLine.indexOf('Status') },
    { name: 'target', start: headerLine.indexOf('Target') },
    { name: 'agentId', start: headerLine.indexOf('Agent ID') },
    { name: 'model', start: headerLine.indexOf('Model') },
  ].filter(c => c.start >= 0)

  // Parse data rows
  const jobs: OpenClawCronJob[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    // skip lines that look like warnings/config noise
    if (line.includes('Config warnings') || line.includes('Doctor warnings') ||
        line.startsWith('│') || line.startsWith('◇') || line.startsWith('├') ||
        line.trim() === '') continue

    const get = (colIdx: number): string => {
      const col = cols[colIdx]
      if (!col) return ''
      const nextStart = cols[colIdx + 1]?.start ?? line.length
      return line.substring(col.start, nextStart).trim()
    }

    const id = get(0)
    // Only accept lines where ID looks like a UUID
    if (!/^[0-9a-f]{8}-/.test(id)) continue

    jobs.push({
      id,
      name: get(1),
      schedule: get(2),
      next: get(3),
      last: get(4),
      status: get(5),
      target: get(6),
      agentId: get(7),
      model: get(8),
    })
  }

  return jobs
}

/* ================================================================== */
/*  parseCronRuns (JSON)                                               */
/* ================================================================== */

export function parseCronRuns(raw: string): OpenClawCronRunsResult {
  const empty: OpenClawCronRunsResult = {
    entries: [], total: 0, offset: 0, limit: 0, hasMore: false, nextOffset: 0,
  }

  // The output may contain warning lines before/after the JSON.
  // Strategy: find first `{` and last `}`, extract that substring.
  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd <= jsonStart) return empty

  try {
    return JSON.parse(raw.substring(jsonStart, jsonEnd + 1))
  } catch {
    return empty
  }
}
