import { useEffect, useState } from 'react'

interface HealthResponse {
  status: string
  version: string
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch(() => setError(true))
  }, [])

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>OpenClaw PixelAgent</h1>
      {error && <p style={{ color: 'red' }}>backend offline</p>}
      {health && (
        <p>
          status: <strong>{health.status}</strong> &nbsp;|&nbsp; version:{' '}
          <strong>{health.version}</strong>
        </p>
      )}
    </div>
  )
}

export default App
