import { useState, useEffect, useCallback } from 'react'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type PlantStage = 'seed' | 'sprout' | 'growing' | 'harvest'

interface PlantEntry {
  id: string
  house: number
  plantType: string
  stage: PlantStage
  plantedDate: string
  expectedHarvest: string
  notes: string
  references: string[]
}

interface LogEntry {
  id: string
  house: number
  timestamp: string
  content: string
}

interface GreenhousePanelProps {
  open: boolean
  onClose: () => void
  /** Which greenhouse was clicked (0, 1, 2) */
  greenhouseIndex: number
  /** WebSocket instance for listening to changes */
  socket: { on: (ev: string, fn: (...args: any[]) => void) => void; off: (ev: string, fn: (...args: any[]) => void) => void }
}

type ContentTab = 'plants' | 'references' | 'log'

/* ================================================================== */
/*  Stage helpers                                                      */
/* ================================================================== */

const STAGE_ORDER: PlantStage[] = ['seed', 'sprout', 'growing', 'harvest']

const STAGE_LABEL: Record<PlantStage, string> = {
  seed: 'Seed',
  sprout: 'Sprout',
  growing: 'Growing',
  harvest: 'Harvest',
}

const STAGE_COLOR: Record<PlantStage, string> = {
  seed: '#8d6e63',
  sprout: '#66bb6a',
  growing: '#43a047',
  harvest: '#fdd835',
}

const STAGE_ICON: Record<PlantStage, string> = {
  seed: '\u{1F331}',    // 🌱
  sprout: '\u{1F33F}',  // 🌿
  growing: '\u{1F33E}', // 🌾
  harvest: '\u{1F33D}', // 🌽
}

const GREENHOUSE_NAMES = ['Greenhouse A', 'Greenhouse B', 'Greenhouse C']
const GREENHOUSE_COLORS = ['#43a047', '#2196f3', '#ff9800']

/* ================================================================== */
/*  Stage Progress Bar                                                 */
/* ================================================================== */

function StageProgress({ stage }: { stage: PlantStage }) {
  const idx = STAGE_ORDER.indexOf(stage)
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {STAGE_ORDER.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: i <= idx ? STAGE_COLOR[s] : '#333',
            border: i === idx ? '2px solid #fff' : '2px solid transparent',
            transition: 'all 0.3s ease',
          }} />
          {i < STAGE_ORDER.length - 1 && (
            <div style={{
              width: 16, height: 2,
              background: i < idx ? STAGE_COLOR[STAGE_ORDER[i + 1]] : '#333',
            }} />
          )}
        </div>
      ))}
      <span style={{ fontSize: 10, color: STAGE_COLOR[stage], marginLeft: 4, fontWeight: 'bold' }}>
        {STAGE_ICON[stage]} {STAGE_LABEL[stage]}
      </span>
    </div>
  )
}

/* ================================================================== */
/*  Add Plant Form                                                     */
/* ================================================================== */

function AddPlantForm({ house, onSubmit, onCancel }: {
  house: number
  onSubmit: (data: Omit<PlantEntry, 'id'>) => void
  onCancel: () => void
}) {
  const [plantType, setPlantType] = useState('')
  const [stage, setStage] = useState<PlantStage>('seed')
  const [notes, setNotes] = useState('')
  const [refInput, setRefInput] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const [plantedDate, setPlantedDate] = useState(today)
  const [expectedHarvest, setExpectedHarvest] = useState('')

  const handleSubmit = () => {
    if (!plantType.trim()) return
    const refs = refInput.split('\n').map(r => r.trim()).filter(Boolean)
    onSubmit({
      house,
      plantType: plantType.trim(),
      stage,
      plantedDate,
      expectedHarvest,
      notes: notes.trim(),
      references: refs,
    })
  }

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #333', background: '#1a1a2e' }}>
      <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#8ab4f8' }}>
        New Plant Entry
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <input
          value={plantType}
          onChange={e => setPlantType(e.target.value)}
          placeholder="Plant type (e.g. Tomato)"
          style={inputStyle}
        />
        <select value={stage} onChange={e => setStage(e.target.value as PlantStage)} style={inputStyle}>
          {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: '#888' }}>
          Planted
          <input type="date" value={plantedDate} onChange={e => setPlantedDate(e.target.value)} style={{ ...inputStyle, marginLeft: 4 }} />
        </label>
        <label style={{ fontSize: 10, color: '#888' }}>
          Expected Harvest
          <input type="date" value={expectedHarvest} onChange={e => setExpectedHarvest(e.target.value)} style={{ ...inputStyle, marginLeft: 4 }} />
        </label>
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes..."
        rows={2}
        style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 6 }}
      />
      <textarea
        value={refInput}
        onChange={e => setRefInput(e.target.value)}
        placeholder="References (one URL per line)"
        rows={2}
        style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 8 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSubmit} style={btnPrimary}>Add</button>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Plant Card                                                         */
/* ================================================================== */

function PlantCard({ plant, onUpdate }: {
  plant: PlantEntry
  onUpdate: (id: string, patch: Partial<PlantEntry>) => void
}) {
  return (
    <div style={{
      background: '#16162a', border: '1px solid #333', borderRadius: 8,
      padding: '10px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#eee' }}>
          {plant.plantType}
        </span>
        <StageProgress stage={plant.stage} />
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#888', marginBottom: 6 }}>
        <span>Planted: {plant.plantedDate || 'N/A'}</span>
        <span>Harvest: {plant.expectedHarvest || 'N/A'}</span>
      </div>

      {plant.notes && (
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, lineHeight: 1.4 }}>
          {plant.notes}
        </div>
      )}

      {/* Stage advance buttons */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {STAGE_ORDER.map(s => (
          <button
            key={s}
            onClick={() => onUpdate(plant.id, { stage: s })}
            disabled={plant.stage === s}
            style={{
              fontSize: 9, fontFamily: 'monospace',
              padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
              background: plant.stage === s ? STAGE_COLOR[s] : '#1a1a2e',
              color: plant.stage === s ? '#000' : '#888',
              border: `1px solid ${plant.stage === s ? STAGE_COLOR[s] : '#444'}`,
              opacity: plant.stage === s ? 1 : 0.7,
            }}
          >
            {STAGE_ICON[s]} {STAGE_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  GreenhousePanel                                                    */
/* ================================================================== */

export function GreenhousePanel({ open, onClose, greenhouseIndex, socket }: GreenhousePanelProps) {
  const [activeHouse, setActiveHouse] = useState(greenhouseIndex)
  const [contentTab, setContentTab] = useState<ContentTab>('plants')
  const [plants, setPlants] = useState<PlantEntry[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [logInput, setLogInput] = useState('')

  // Sync active house when clicking different greenhouse in scene
  useEffect(() => {
    if (open) setActiveHouse(greenhouseIndex)
  }, [open, greenhouseIndex])

  const fetchPlants = useCallback(async (house: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/greenhouse?house=${house}`)
      if (res.ok) setPlants(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const fetchLogs = useCallback(async (house: number) => {
    try {
      const res = await fetch(`/api/greenhouse/logs?house=${house}`)
      if (res.ok) setLogs(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (open) {
      fetchPlants(activeHouse)
      fetchLogs(activeHouse)
      setShowAddForm(false)
    }
  }, [open, activeHouse, fetchPlants, fetchLogs])

  // WebSocket: re-fetch on greenhouse:changed
  useEffect(() => {
    const onChanged = () => {
      fetchPlants(activeHouse)
      fetchLogs(activeHouse)
    }
    socket.on('greenhouse:changed', onChanged)
    return () => { socket.off('greenhouse:changed', onChanged) }
  }, [socket, activeHouse, fetchPlants, fetchLogs])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleAdd = async (data: Omit<PlantEntry, 'id'>) => {
    try {
      const res = await fetch('/api/greenhouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await fetchPlants(activeHouse)
        setShowAddForm(false)
      }
    } catch { /* ignore */ }
  }

  const handleUpdate = async (id: string, patch: Partial<PlantEntry>) => {
    try {
      await fetch(`/api/greenhouse/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      await fetchPlants(activeHouse)
    } catch { /* ignore */ }
  }

  const handleAddLog = async () => {
    const trimmed = logInput.trim()
    if (!trimmed) return
    try {
      await fetch('/api/greenhouse/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ house: activeHouse, content: trimmed }),
      })
      setLogInput('')
      await fetchLogs(activeHouse)
    } catch { /* ignore */ }
  }

  const handleDeleteLog = async (id: string) => {
    try {
      await fetch(`/api/greenhouse/logs/${id}`, { method: 'DELETE' })
      await fetchLogs(activeHouse)
    } catch { /* ignore */ }
  }

  if (!open) return null

  const allRefs = plants.flatMap(p => p.references.map(url => ({ plantType: p.plantType, url })))

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
        width: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #333',
        }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>
            {'\u{1F33F}'} Greenhouse
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#aaa',
              fontSize: 20, cursor: 'pointer', lineHeight: 1,
            }}
          >x</button>
        </div>

        {/* Greenhouse tabs (A / B / C) */}
        <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
          {GREENHOUSE_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => { setActiveHouse(i); setShowAddForm(false) }}
              style={{
                flex: 1, padding: '8px 0', cursor: 'pointer',
                background: 'none',
                color: activeHouse === i ? '#eee' : '#666',
                border: 'none', fontFamily: 'monospace', fontSize: 12,
                borderBottom: activeHouse === i
                  ? `2px solid ${GREENHOUSE_COLORS[i]}`
                  : '2px solid transparent',
                fontWeight: activeHouse === i ? 'bold' : 'normal',
              }}
            >
              {STAGE_ICON.sprout} {name}
            </button>
          ))}
        </div>

        {/* Content tabs (Cultivation Data / References) */}
        <div style={{ display: 'flex', borderBottom: '1px solid #2a2a3e' }}>
          {([['plants', '\u{1F331} Cultivation'], ['log', '\u{1F4DD} Log'], ['references', '\u{1F4DA} References']] as [ContentTab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setContentTab(t)}
              style={{
                flex: 1, padding: '6px 0', cursor: 'pointer',
                background: 'none', color: contentTab === t ? '#ccc' : '#666',
                border: 'none', fontFamily: 'monospace', fontSize: 11,
                borderBottom: contentTab === t ? '1px solid #888' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {contentTab === 'plants' && (
            <div style={{ padding: 16 }}>
              {loading && <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>Loading...</div>}

              {!loading && plants.length === 0 && (
                <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>
                  No plants in {GREENHOUSE_NAMES[activeHouse]}. Click "Add Plant" to start.
                </div>
              )}

              {!loading && plants.map(p => (
                <PlantCard key={p.id} plant={p} onUpdate={handleUpdate} />
              ))}

              {!showAddForm && !loading && (
                <button onClick={() => setShowAddForm(true)} style={{ ...btnPrimary, marginTop: 8 }}>
                  + Add Plant
                </button>
              )}
            </div>
          )}

          {contentTab === 'log' && (
            <div style={{ padding: 16 }}>
              {/* New log input */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <textarea
                  value={logInput}
                  onChange={e => setLogInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddLog() } }}
                  placeholder="Write a cultivation log entry... (Enter to submit, Shift+Enter for newline)"
                  rows={2}
                  style={{
                    ...inputStyle, flex: 1, resize: 'vertical',
                    width: 'auto',
                  }}
                />
                <button onClick={handleAddLog} style={{ ...btnPrimary, alignSelf: 'flex-end' }}>
                  Add
                </button>
              </div>

              {logs.length === 0 && (
                <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>
                  No logs in {GREENHOUSE_NAMES[activeHouse]} yet.
                </div>
              )}

              {logs.map(log => (
                <div key={log.id} style={{
                  background: '#16162a', border: '1px solid #333', borderRadius: 6,
                  padding: '8px 12px', marginBottom: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#888' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      title="Delete"
                      style={{
                        background: 'none', border: 'none', color: '#666',
                        fontSize: 12, cursor: 'pointer', padding: '0 4px',
                      }}
                    >x</button>
                  </div>
                  <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {log.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {contentTab === 'references' && (
            <div style={{ padding: 16 }}>
              {allRefs.length === 0 && (
                <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>
                  No references in {GREENHOUSE_NAMES[activeHouse]}.
                </div>
              )}
              {allRefs.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, alignItems: 'center',
                  padding: '6px 0', borderBottom: '1px solid #2a2a3e',
                }}>
                  <span style={{ fontSize: 10, color: '#888', minWidth: 80 }}>{r.plantType}</span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: '#8ab4f8', wordBreak: 'break-all' }}
                  >
                    {r.url}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add form */}
        {showAddForm && contentTab === 'plants' && (
          <AddPlantForm
            house={activeHouse}
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const inputStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11,
  background: '#2a2a3e', color: '#eee',
  border: '1px solid #444', borderRadius: 4,
  padding: '4px 8px',
}

const btnPrimary: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11,
  background: '#43a047', color: '#fff',
  border: 'none', borderRadius: 4,
  padding: '6px 16px', cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11,
  background: '#333', color: '#aaa',
  border: '1px solid #444', borderRadius: 4,
  padding: '6px 16px', cursor: 'pointer',
}
