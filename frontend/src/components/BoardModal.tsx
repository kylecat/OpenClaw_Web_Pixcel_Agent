import { useState, useEffect, useCallback } from 'react'
import {
  fetchTasks, createTask, updateTask, deleteTask,
  fetchAlerts, createAlert, updateAlert, deleteAlert,
  type TaskItem, type AlertItem,
} from '../api/board'

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

interface BoardModalProps {
  open: boolean
  onClose: () => void
  /** Incremented by App when a WebSocket board:changed event is received */
  boardVersion?: number
}

/* ================================================================== */
/*  Color maps                                                         */
/* ================================================================== */

const PRIORITY_COLOR: Record<string, string> = {
  P0: '#e74c3c',
  P1: '#f39c12',
  P2: '#3498db',
}

const STATUS_COLOR: Record<string, string> = {
  todo: '#888',
  doing: '#f39c12',
  done: '#27ae60',
  archived: '#6c5ce7',
}

const LEVEL_COLOR: Record<string, string> = {
  info: '#3498db',
  warning: '#f39c12',
  error: '#e74c3c',
  critical: '#c0392b',
}

/* ================================================================== */
/*  BoardModal                                                         */
/* ================================================================== */

export function BoardModal({ open, onClose, boardVersion }: BoardModalProps) {
  const [tab, setTab] = useState<'tasks' | 'alerts'>('tasks')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showAddAlert, setShowAddAlert] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [t, a] = await Promise.all([fetchTasks(), fetchAlerts()])
      setTasks(t)
      setAlerts(a)
    } catch (e) {
      console.error('Board reload failed', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) reload()
  }, [open, reload])

  // Re-fetch when another client mutates board data (via WebSocket)
  useEffect(() => {
    if (open && boardVersion) reload()
  }, [boardVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#1e1e2e', border: '1px solid #444', borderRadius: 12,
        color: '#eee', fontFamily: 'monospace',
        width: 864, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #333',
        }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>Bulletin Board</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#aaa',
              fontSize: 20, cursor: 'pointer', lineHeight: 1,
            }}
          >x</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
          {(['tasks', 'alerts'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', cursor: 'pointer',
                background: 'none', color: tab === t ? '#eee' : '#888',
                border: 'none', fontFamily: 'monospace', fontSize: 13,
                borderBottom: tab === t ? '2px solid #3a6ea5' : '2px solid transparent',
              }}
            >
              {t === 'tasks' ? 'Task Board' : 'System Alerts'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading
            ? <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>Loading...</div>
            : tab === 'tasks'
              ? <TaskBoardTab
                  tasks={tasks}
                  showAdd={showAddTask}
                  onToggleAdd={() => setShowAddTask(v => !v)}
                  onReload={reload}
                />
              : <AlertsTab
                  alerts={alerts}
                  showAdd={showAddAlert}
                  onToggleAdd={() => setShowAddAlert(v => !v)}
                  onReload={reload}
                />
          }
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Task Board Tab (with filters)                                      */
/* ================================================================== */

function TaskBoardTab({ tasks, showAdd, onToggleAdd, onReload }: {
  tasks: TaskItem[]
  showAdd: boolean
  onToggleAdd: () => void
  onReload: () => void
}) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')

  const filtered = tasks.filter(t =>
    (filterStatus === 'all' ? t.status !== 'archived' : t.status === filterStatus) &&
    (filterAssignee === 'all' || t.assignee === filterAssignee) &&
    (filterPriority === 'all' || t.priority === filterPriority),
  )

  return (
    <>
      {/* Toolbar: filters + add button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterSelect}>
          <option value="all">All Status</option>
          <option value="todo">todo</option>
          <option value="doing">doing</option>
          <option value="done">done</option>
          <option value="archived">archived</option>
        </select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={filterSelect}>
          <option value="all">All Assignee</option>
          <option value="gaia">Gaia</option>
          <option value="astraea">Astraea</option>
          <option value="anyone">Anyone</option>
          <option value="unassigned">unassigned</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={filterSelect}>
          <option value="all">All Priority</option>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
        </select>
        <span style={{ flex: 1, fontSize: 11, color: '#666', textAlign: 'right' }}>
          {filtered.length}/{tasks.length}
        </span>
        <button onClick={onToggleAdd} style={btnStyle}>
          {showAdd ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {showAdd && <AddTaskForm onCreated={() => { onToggleAdd(); onReload() }} />}

      {filtered.length === 0 && !showAdd && (
        <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>No tasks match filters.</div>
      )}

      {filtered.map(t => (
        <TaskCard key={t.id} task={t} onReload={onReload} />
      ))}
    </>
  )
}

/* ================================================================== */
/*  Task Card (with workflow rules)                                    */
/* ================================================================== */

function TaskCard({ task, onReload }: { task: TaskItem; onReload: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editContent, setEditContent] = useState(task.content)
  const [editAssignee, setEditAssignee] = useState(task.assignee)
  const [editPriority, setEditPriority] = useState(task.priority)
  const [saving, setSaving] = useState(false)

  const handleStatusChange = async (status: string) => {
    await updateTask(task.id, { status })
    onReload()
  }

  const handleAssigneeChange = async (assignee: string) => {
    await updateTask(task.id, { assignee })
    onReload()
  }

  const handlePriorityChange = async (priority: string) => {
    await updateTask(task.id, { priority })
    onReload()
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteTask(task.id)
    onReload()
  }

  const handleModifySave = async () => {
    setSaving(true)
    try {
      await updateTask(task.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        assignee: editAssignee,
        priority: editPriority,
      })
      setEditing(false)
      onReload()
    } catch (e) {
      console.error('modify task failed', e)
    } finally {
      setSaving(false)
    }
  }

  const handleModifyCancel = () => {
    setEditTitle(task.title)
    setEditContent(task.content)
    setEditAssignee(task.assignee)
    setEditPriority(task.priority)
    setEditing(false)
  }

  const handleArchive = async () => {
    await updateTask(task.id, { status: 'archived' })
    onReload()
  }

  const isTodo = task.status === 'todo'
  const isDoing = task.status === 'doing'
  const isDone = task.status === 'done'
  const isArchived = task.status === 'archived'
  const needsCollapse = task.content.length > 100 || task.content.split('\n').length > 2

  if (editing) {
    return (
      <div style={{
        border: '1px solid #3a6ea5', borderRadius: 8, padding: 10, marginBottom: 8,
        background: '#2a2a3e',
      }}>
        <div style={{ fontSize: 11, color: '#3a6ea5', marginBottom: 6, fontWeight: 'bold' }}>
          Modify {task.id}
        </div>
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          placeholder="Task title..."
          style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>Assignee</label>
            <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)} style={selectStyle}>
              <option value="unassigned">unassigned</option>
              <option value="gaia">Gaia</option>
              <option value="astraea">Astraea</option>
              <option value="anyone">Anyone</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select value={editPriority} onChange={e => setEditPriority(e.target.value)} style={selectStyle}>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
            </select>
          </div>
        </div>
        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          placeholder="Content..."
          rows={4}
          style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleModifySave} disabled={saving || !editTitle.trim()} style={btnAction('#3a6ea5')}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={handleModifyCancel} style={btnAction('#666')}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      border: '1px solid #333', borderRadius: 8, padding: 10, marginBottom: 8,
      background: '#242438',
      opacity: isArchived ? 0.45 : isDone ? 0.7 : 1,
    }}>
      {/* Row 1: badges + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={badge(PRIORITY_COLOR[task.priority] ?? '#888')}>{task.priority}</span>
        <span style={badge(STATUS_COLOR[task.status] ?? '#888')}>{task.status}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 'bold' }}>{task.title}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{task.id}</span>
      </div>

      {/* Row 2: workflow controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        {/* TODO: editable dropdowns + Modify + Start buttons */}
        {isTodo && (
          <>
            <label style={{ fontSize: 11, color: '#aaa' }}>Assignee:</label>
            <select value={task.assignee} onChange={e => handleAssigneeChange(e.target.value)} style={selectStyle}>
              <option value="unassigned">unassigned</option>
              <option value="gaia">Gaia</option>
              <option value="astraea">Astraea</option>
              <option value="anyone">Anyone</option>
            </select>
            <label style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>Priority:</label>
            <select value={task.priority} onChange={e => handlePriorityChange(e.target.value)} style={selectStyle}>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
            </select>
            <button onClick={() => handleStatusChange('doing')} style={btnAction('#f39c12')}>
              Start
            </button>
          </>
        )}

        {/* DOING: Cancel + Complete buttons */}
        {isDoing && (
          <>
            <span style={{ fontSize: 11, color: '#aaa' }}>
              Assignee: <strong style={{ color: '#eee' }}>{task.assignee}</strong>
            </span>
            <button onClick={() => handleStatusChange('todo')} style={btnAction('#888')}>
              Cancel
            </button>
            <button onClick={() => handleStatusChange('done')} style={btnAction('#27ae60')}>
              Complete
            </button>
          </>
        )}

        {/* DONE: read-only info + archive button */}
        {isDone && (
          <>
            <span style={{ fontSize: 11, color: '#aaa' }}>
              Assignee: <strong style={{ color: '#eee' }}>{task.assignee}</strong>
            </span>
            <button onClick={handleArchive} style={btnAction('#6c5ce7')}>
              Archive
            </button>
          </>
        )}

        {/* ARCHIVED: read-only info */}
        {isArchived && (
          <span style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
            Archived — {task.assignee}
          </span>
        )}

        {/* Modify + Delete (right-aligned, vertical) */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {isTodo && (
            <button
              onClick={() => setEditing(true)}
              style={{
                background: '#555', border: 'none', borderRadius: 3,
                color: '#fff', cursor: 'pointer',
                fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold',
                padding: '2px 8px', letterSpacing: 0.5,
              }}
            >
              MODIFY
            </button>
          )}
          <button
            onClick={handleDelete}
            style={{
              background: 'none', border: '1px solid',
              borderColor: confirmDelete ? '#e74c3c' : '#666', borderRadius: 3,
              color: confirmDelete ? '#e74c3c' : '#888', cursor: 'pointer',
              fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold',
              padding: '1px 8px', letterSpacing: 0.5,
            }}
          >
            {confirmDelete ? 'CONFIRM?' : 'DELETE'}
          </button>
        </div>
      </div>

      {/* Content (collapsible) */}
      {task.content && (
        <div style={{ marginTop: 6 }}>
          <div style={{
            fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap',
            maxHeight: !needsCollapse || expanded ? 'none' : 48,
            overflow: 'hidden',
          }}>
            {task.content}
          </div>
          {needsCollapse && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                background: 'none', border: 'none', color: '#3a6ea5',
                cursor: 'pointer', fontSize: 11, padding: 0, marginTop: 2,
                fontFamily: 'monospace',
              }}
            >
              {expanded ? 'Show less' : 'Show more...'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/*  Add Task Form                                                      */
/* ================================================================== */

function AddTaskForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('unassigned')
  const [priority, setPriority] = useState('P1')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await createTask({ title: title.trim(), assignee, priority, content: content.trim() })
      onCreated()
    } catch (e) {
      console.error('createTask failed', e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      border: '1px solid #444', borderRadius: 8, padding: 12, marginBottom: 12,
      background: '#2a2a3e',
    }}>
      <input
        placeholder="Task title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Assignee</label>
          <select value={assignee} onChange={e => setAssignee(e.target.value)} style={selectStyle}>
            <option value="unassigned">unassigned</option>
            <option value="gaia">Gaia</option>
            <option value="astraea">Astraea</option>
            <option value="anyone">Anyone</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
          </select>
        </div>
      </div>
      <textarea
        placeholder="Content (optional)..."
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={3}
        style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 8 }}
      />
      <button onClick={handleSubmit} disabled={submitting || !title.trim()} style={btnStyle}>
        {submitting ? 'Creating...' : 'Create Task'}
      </button>
    </div>
  )
}

/* ================================================================== */
/*  Alerts Tab (with filters)                                          */
/* ================================================================== */

function AlertsTab({ alerts, showAdd, onToggleAdd, onReload }: {
  alerts: AlertItem[]
  showAdd: boolean
  onToggleAdd: () => void
  onReload: () => void
}) {
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [filterAck, setFilterAck] = useState('all')

  const filtered = alerts.filter(a =>
    (filterLevel === 'all' || a.level === filterLevel) &&
    (filterSource === 'all' || a.source === filterSource) &&
    (filterAck === 'all' ||
      (filterAck === 'yes' && a.acknowledged) ||
      (filterAck === 'no' && !a.acknowledged)),
  )

  return (
    <>
      {/* Toolbar: filters + add button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={filterSelect}>
          <option value="all">All Level</option>
          <option value="info">info</option>
          <option value="warning">warning</option>
          <option value="error">error</option>
          <option value="critical">critical</option>
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={filterSelect}>
          <option value="all">All Source</option>
          <option value="manual">manual</option>
          <option value="openclaw">openclaw</option>
          <option value="host">host</option>
          <option value="iot">iot</option>
        </select>
        <select value={filterAck} onChange={e => setFilterAck(e.target.value)} style={filterSelect}>
          <option value="all">All Ack</option>
          <option value="no">Unacknowledged</option>
          <option value="yes">Acknowledged</option>
        </select>
        <span style={{ flex: 1, fontSize: 11, color: '#666', textAlign: 'right' }}>
          {filtered.length}/{alerts.length}
        </span>
        <button onClick={onToggleAdd} style={btnStyle}>
          {showAdd ? 'Cancel' : '+ Add Alert'}
        </button>
      </div>

      {showAdd && <AddAlertForm onCreated={() => { onToggleAdd(); onReload() }} />}

      {filtered.length === 0 && !showAdd && (
        <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>No alerts match filters.</div>
      )}

      {filtered.map(a => (
        <AlertCard key={a.id} alert={a} onReload={onReload} />
      ))}
    </>
  )
}

/* ================================================================== */
/*  Alert Card                                                         */
/* ================================================================== */

function AlertCard({ alert, onReload }: { alert: AlertItem; onReload: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDismiss, setConfirmDismiss] = useState(false)

  const handleAcknowledge = async () => {
    await updateAlert(alert.id, { acknowledged: true })
    onReload()
  }

  const handleDismiss = async () => {
    if (!confirmDismiss) { setConfirmDismiss(true); return }
    await deleteAlert(alert.id)
    onReload()
  }

  const needsCollapse = alert.content.length > 100 || alert.content.split('\n').length > 2

  return (
    <div style={{
      border: '1px solid #333', borderRadius: 8, padding: 10, marginBottom: 8,
      background: '#242438',
      opacity: alert.acknowledged ? 0.6 : 1,
    }}>
      {/* Row 1: level badge + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={badge(LEVEL_COLOR[alert.level] ?? '#888')}>{alert.level}</span>
        <span style={{
          fontSize: 10, color: '#888', background: '#333', borderRadius: 4,
          padding: '1px 5px',
        }}>{alert.source}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 'bold' }}>{alert.title}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{alert.id}</span>
      </div>

      {/* Row 2: time + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#888' }}>
          {new Date(alert.created).toLocaleString()}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {!alert.acknowledged && (
            <button onClick={handleAcknowledge} style={btnSmall}>Acknowledge</button>
          )}
          <button
            onClick={handleDismiss}
            style={{
              ...btnSmall,
              color: confirmDismiss ? '#e74c3c' : '#aaa',
              borderColor: confirmDismiss ? '#e74c3c' : '#555',
            }}
          >
            {confirmDismiss ? 'Confirm?' : 'Dismiss'}
          </button>
        </div>
      </div>

      {/* Content (collapsible) */}
      {alert.content && (
        <div style={{ marginTop: 6 }}>
          <div style={{
            fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap',
            maxHeight: !needsCollapse || expanded ? 'none' : 48,
            overflow: 'hidden',
          }}>
            {alert.content}
          </div>
          {needsCollapse && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                background: 'none', border: 'none', color: '#3a6ea5',
                cursor: 'pointer', fontSize: 11, padding: 0, marginTop: 2,
                fontFamily: 'monospace',
              }}
            >
              {expanded ? 'Show less' : 'Show more...'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/*  Add Alert Form                                                     */
/* ================================================================== */

function AddAlertForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('info')
  const [source, setSource] = useState('manual')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await createAlert({ title: title.trim(), level, source, content: content.trim() })
      onCreated()
    } catch (e) {
      console.error('createAlert failed', e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      border: '1px solid #444', borderRadius: 8, padding: 12, marginBottom: 12,
      background: '#2a2a3e',
    }}>
      <input
        placeholder="Alert title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)} style={selectStyle}>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
            <option value="critical">critical</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Source</label>
          <select value={source} onChange={e => setSource(e.target.value)} style={selectStyle}>
            <option value="manual">manual</option>
            <option value="openclaw">openclaw</option>
            <option value="host">host</option>
            <option value="iot">iot</option>
          </select>
        </div>
      </div>
      <textarea
        placeholder="Content (optional)..."
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={3}
        style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 8 }}
      />
      <button onClick={handleSubmit} disabled={submitting || !title.trim()} style={btnStyle}>
        {submitting ? 'Creating...' : 'Create Alert'}
      </button>
    </div>
  )
}

/* ================================================================== */
/*  Shared inline styles                                               */
/* ================================================================== */

const btnStyle: React.CSSProperties = {
  fontFamily: 'monospace', background: '#3a6ea5', color: '#fff',
  border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer',
  fontSize: 12,
}

const btnSmall: React.CSSProperties = {
  fontFamily: 'monospace', background: 'none',
  color: '#aaa', border: '1px solid #555', borderRadius: 4,
  padding: '2px 8px', cursor: 'pointer', fontSize: 11,
}

function btnAction(color: string): React.CSSProperties {
  return {
    fontFamily: 'monospace', background: color, color: '#fff',
    border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer',
    fontSize: 11,
  }
}

const selectStyle: React.CSSProperties = {
  fontFamily: 'monospace', background: '#2a2a3e', color: '#eee',
  border: '1px solid #444', borderRadius: 4, padding: '2px 6px', fontSize: 12,
}

const filterSelect: React.CSSProperties = {
  fontFamily: 'monospace', background: '#1a1a2e', color: '#ccc',
  border: '1px solid #555', borderRadius: 4, padding: '3px 6px', fontSize: 11,
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'monospace', background: '#1a1a2e', color: '#eee',
  border: '1px solid #444', borderRadius: 4, padding: '6px 8px', fontSize: 12,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#aaa', display: 'block', marginBottom: 2,
}

function badge(color: string): React.CSSProperties {
  return {
    fontSize: 10, fontWeight: 'bold', color: '#fff',
    background: color, borderRadius: 4, padding: '1px 6px',
    textTransform: 'uppercase',
  }
}
