/* ------------------------------------------------------------------ */
/*  Board API — Tasks & Alerts fetch helpers                           */
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

const BASE = '/api/board'

/* ---------- Tasks ---------- */

export async function fetchTasks(): Promise<TaskItem[]> {
  const res = await fetch(`${BASE}/tasks`)
  if (!res.ok) throw new Error(`fetchTasks failed: ${res.status}`)
  return res.json()
}

export async function createTask(data: {
  title: string
  assignee?: string
  priority?: string
  content?: string
}): Promise<TaskItem> {
  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`createTask failed: ${res.status}`)
  return res.json()
}

export async function updateTask(
  id: string,
  data: Partial<Pick<TaskItem, 'title' | 'assignee' | 'status' | 'priority' | 'content'>>,
): Promise<TaskItem> {
  const res = await fetch(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`updateTask failed: ${res.status}`)
  return res.json()
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteTask failed: ${res.status}`)
}

/* ---------- Alerts ---------- */

export async function fetchAlerts(week?: string): Promise<AlertItem[]> {
  const url = week ? `${BASE}/alerts?week=${encodeURIComponent(week)}` : `${BASE}/alerts`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetchAlerts failed: ${res.status}`)
  return res.json()
}

export async function createAlert(data: {
  title: string
  level?: string
  source?: string
  content?: string
}): Promise<AlertItem> {
  const res = await fetch(`${BASE}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`createAlert failed: ${res.status}`)
  return res.json()
}

export async function updateAlert(
  id: string,
  data: { acknowledged: boolean },
): Promise<AlertItem> {
  const res = await fetch(`${BASE}/alerts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`updateAlert failed: ${res.status}`)
  return res.json()
}

export async function deleteAlert(id: string): Promise<void> {
  const res = await fetch(`${BASE}/alerts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteAlert failed: ${res.status}`)
}
