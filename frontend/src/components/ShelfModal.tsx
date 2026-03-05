import { useState, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface ShelfModalProps {
  open: boolean
  onClose: () => void
  shelfId: 'shelf1' | 'shelf2' | 'shelf3'
}

interface FileEntry {
  name: string
  isDir: boolean
  size: number
  modifiedAt: string
}

interface FileContent {
  name: string
  content: string
  size: number
  modifiedAt: string
}

/* ================================================================== */
/*  Root config per shelf                                              */
/* ================================================================== */

interface RootTab {
  key: string      // API rootKey
  label: string    // display label
}

const SHELF_CONFIG: Record<string, { title: string; roots: RootTab[] }> = {
  shelf1: {
    title: 'Research Log',
    roots: [{ key: 'research', label: 'ResearchLog' }],
  },
  shelf2: {
    title: 'SKILL',
    roots: [{ key: 'skills', label: 'Skills' }],
  },
  shelf3: {
    title: 'Project Files',
    roots: [
      { key: 'data', label: 'Data' },
      { key: 'devdocs', label: 'DevDocuments' },
    ],
  },
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function isMarkdown(name: string): boolean {
  return /\.md$/i.test(name)
}

/** Renders .md with react-markdown + GFM; everything else as plain <pre>. */
function FilePreview({ content, name }: { content: string; name: string }) {
  if (isMarkdown(name)) {
    return (
      <div className="shelf-md" style={{ fontSize: 13, lineHeight: 1.7, color: '#ccc' }}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#eee', margin: '16px 0 8px', borderBottom: '1px solid #333', paddingBottom: 6 }}>{children}</h1>,
            h2: ({ children }) => <h2 style={{ fontSize: 17, fontWeight: 'bold', color: '#eee', margin: '14px 0 6px' }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 'bold', color: '#ddd', margin: '12px 0 4px' }}>{children}</h3>,
            h4: ({ children }) => <h4 style={{ fontSize: 13, fontWeight: 'bold', color: '#ddd', margin: '10px 0 4px' }}>{children}</h4>,
            p: ({ children }) => <p style={{ margin: '6px 0' }}>{children}</p>,
            a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#8ab4f8' }}>{children}</a>,
            strong: ({ children }) => <strong style={{ color: '#eee' }}>{children}</strong>,
            em: ({ children }) => <em style={{ color: '#bbb' }}>{children}</em>,
            code: ({ className, children }) => {
              const isBlock = className?.startsWith('language-')
              if (isBlock) {
                return (
                  <pre style={{ background: '#141422', border: '1px solid #333', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', fontSize: 12, lineHeight: 1.5 }}>
                    <code style={{ color: '#a8d8a8' }}>{children}</code>
                  </pre>
                )
              }
              return <code style={{ background: '#2a2a3e', padding: '1px 5px', borderRadius: 3, fontSize: '0.9em', color: '#e8b87a' }}>{children}</code>
            },
            pre: ({ children }) => <>{children}</>,
            blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #3a6ea5', paddingLeft: 12, margin: '8px 0', color: '#aaa' }}>{children}</blockquote>,
            ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ol>,
            li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
            table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '8px 0', fontSize: 12 }}>{children}</table>,
            th: ({ children }) => <th style={{ border: '1px solid #444', padding: '4px 8px', background: '#2a2a3e', color: '#eee', textAlign: 'left' }}>{children}</th>,
            td: ({ children }) => <td style={{ border: '1px solid #333', padding: '4px 8px' }}>{children}</td>,
            hr: () => <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '12px 0' }} />,
            img: ({ src, alt }) => <img src={src} alt={alt} style={{ maxWidth: '100%', borderRadius: 4 }} />,
          }}
        >
          {content}
        </Markdown>
      </div>
    )
  }

  // JSON: attempt pretty-print
  if (/\.json$/i.test(name)) {
    try {
      const formatted = JSON.stringify(JSON.parse(content), null, 2)
      return (
        <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#a8d8a8', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {formatted}
        </pre>
      )
    } catch { /* fall through to plain text */ }
  }

  return (
    <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {content}
    </pre>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(entry: FileEntry): string {
  if (entry.isDir) return '\u{1F4C1}'  // 📁
  const ext = entry.name.split('.').pop()?.toLowerCase()
  if (ext === 'md') return '\u{1F4DD}'  // 📝
  if (ext === 'json') return '\u{1F4CB}' // 📋
  if (ext === 'ts' || ext === 'js') return '\u{1F4C4}' // 📄
  return '\u{1F4C4}' // 📄
}

/* ================================================================== */
/*  ShelfModal                                                         */
/* ================================================================== */

export function ShelfModal({ open, onClose, shelfId }: ShelfModalProps) {
  const config = SHELF_CONFIG[shelfId]
  const [activeRoot, setActiveRoot] = useState(config.roots[0].key)
  const [subPath, setSubPath] = useState('')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Preview state
  const [preview, setPreview] = useState<FileContent | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  // Reset state when shelf changes or modal opens
  useEffect(() => {
    if (open) {
      const cfg = SHELF_CONFIG[shelfId]
      setActiveRoot(cfg.roots[0].key)
      setSubPath('')
      setPreview(null)
      setPreviewError('')
    }
  }, [open, shelfId])

  // Fetch file list
  const fetchFiles = useCallback(async (rootKey: string, sub: string) => {
    setLoading(true)
    setError('')
    try {
      const params = sub ? `?sub=${encodeURIComponent(sub)}` : ''
      const res = await fetch(`/api/shelf/${rootKey}${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      setFiles(await res.json())
    } catch (e: any) {
      setError(e.message ?? 'Failed to load files')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-fetch when root or subPath changes
  useEffect(() => {
    if (open) fetchFiles(activeRoot, subPath)
  }, [open, activeRoot, subPath, fetchFiles])

  // Fetch file content for preview
  const openPreview = useCallback(async (rootKey: string, filePath: string) => {
    setPreviewLoading(true)
    setPreviewError('')
    setPreview(null)
    try {
      const res = await fetch(
        `/api/shelf/${rootKey}/file?path=${encodeURIComponent(filePath)}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      setPreview(await res.json())
    } catch (e: any) {
      setPreviewError(e.message ?? 'Failed to load file')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.isDir) {
      setSubPath(subPath ? `${subPath}/${entry.name}` : entry.name)
      setPreview(null)
      setPreviewError('')
    } else {
      const filePath = subPath ? `${subPath}/${entry.name}` : entry.name
      openPreview(activeRoot, filePath)
    }
  }

  // Breadcrumb segments
  const breadcrumbs = subPath ? subPath.split('/') : []

  const navigateBreadcrumb = (index: number) => {
    if (index < 0) {
      setSubPath('')
    } else {
      setSubPath(breadcrumbs.slice(0, index + 1).join('/'))
    }
    setPreview(null)
    setPreviewError('')
  }

  const handleTabChange = (rootKey: string) => {
    setActiveRoot(rootKey)
    setSubPath('')
    setPreview(null)
    setPreviewError('')
  }

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
        width: 900, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #333',
        }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>
            {'\u{1F4DA}'} {config.title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#aaa',
              fontSize: 20, cursor: 'pointer', lineHeight: 1,
            }}
          >x</button>
        </div>

        {/* Tabs (only for multi-root shelves) */}
        {config.roots.length > 1 && (
          <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
            {config.roots.map(r => (
              <button
                key={r.key}
                onClick={() => handleTabChange(r.key)}
                style={{
                  flex: 1, padding: '8px 0', cursor: 'pointer',
                  background: 'none', color: activeRoot === r.key ? '#eee' : '#888',
                  border: 'none', fontFamily: 'monospace', fontSize: 13,
                  borderBottom: activeRoot === r.key ? '2px solid #3a6ea5' : '2px solid transparent',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Breadcrumb */}
        <div style={{
          padding: '6px 16px', fontSize: 11, color: '#888',
          borderBottom: '1px solid #2a2a3e',
          display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
        }}>
          <span
            onClick={() => navigateBreadcrumb(-1)}
            style={{ cursor: 'pointer', color: subPath ? '#3a6ea5' : '#ccc' }}
          >
            {config.roots.find(r => r.key === activeRoot)?.label ?? activeRoot}
          </span>
          {breadcrumbs.map((seg, i) => (
            <span key={i}>
              <span style={{ color: '#555', margin: '0 2px' }}>/</span>
              <span
                onClick={() => navigateBreadcrumb(i)}
                style={{
                  cursor: i < breadcrumbs.length - 1 ? 'pointer' : 'default',
                  color: i < breadcrumbs.length - 1 ? '#3a6ea5' : '#ccc',
                }}
              >
                {seg}
              </span>
            </span>
          ))}
        </div>

        {/* Content: split left/right */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* File list (left) */}
          <div style={{
            width: 320, borderRight: '1px solid #333',
            overflowY: 'auto', padding: '8px 0',
          }}>
            {loading && (
              <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>Loading...</div>
            )}
            {error && (
              <div style={{ color: '#e74c3c', textAlign: 'center', padding: 24, fontSize: 12 }}>{error}</div>
            )}
            {!loading && !error && files.length === 0 && (
              <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>Empty directory</div>
            )}
            {!loading && !error && files.map(entry => (
              <div
                key={entry.name}
                onClick={() => handleEntryClick(entry)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 16px', cursor: 'pointer',
                  background: preview?.name === entry.name ? '#2a2a3e' : 'transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2a2a3e' }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background =
                    preview?.name === entry.name ? '#2a2a3e' : 'transparent'
                }}
              >
                <span style={{ fontSize: 14 }}>{fileIcon(entry)}</span>
                <span style={{
                  flex: 1, fontSize: 12,
                  color: entry.isDir ? '#8ab4f8' : '#ccc',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.name}{entry.isDir ? '/' : ''}
                </span>
                {!entry.isDir && (
                  <span style={{ fontSize: 10, color: '#666', flexShrink: 0 }}>
                    {formatSize(entry.size)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Preview (right) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {previewLoading && (
              <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>Loading preview...</div>
            )}
            {previewError && (
              <div style={{ color: '#e74c3c', textAlign: 'center', padding: 32, fontSize: 12 }}>
                {previewError}
              </div>
            )}
            {!previewLoading && !previewError && !preview && (
              <div style={{ color: '#555', textAlign: 'center', padding: 32 }}>
                Select a file to preview
              </div>
            )}
            {preview && !previewLoading && (
              <>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #333',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 'bold' }}>{preview.name}</span>
                  <span style={{ fontSize: 10, color: '#888' }}>
                    {formatSize(preview.size)}
                  </span>
                </div>
                <FilePreview content={preview.content} name={preview.name} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
