import { useState, useEffect, useCallback } from 'react'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface CurrentWeather {
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  description: string
  icon: string
  updatedAt: string
}

interface DayForecast {
  date: string
  tempHigh: number
  tempLow: number
  description: string
  icon: string
  rainChance: number
}

interface ForecastResponse {
  days: DayForecast[]
  updatedAt: string
}

interface WeatherPanelProps {
  open: boolean
  onClose: () => void
}

/* ================================================================== */
/*  Weather icon mapping                                               */
/* ================================================================== */

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '\u{2600}\u{FE0F}',       // ☀️
  clear: '\u{1F31F}',              // 🌟
  partly_cloudy: '\u{26C5}',      // ⛅
  cloudy: '\u{2601}\u{FE0F}',      // ☁️
  rain: '\u{1F327}\u{FE0F}',       // 🌧️
  light_rain: '\u{1F326}\u{FE0F}', // 🌦️
  storm: '\u{26C8}\u{FE0F}',       // ⛈️
  snow: '\u{2744}\u{FE0F}',        // ❄️
  fog: '\u{1F32B}\u{FE0F}',        // 🌫️
}

function weatherEmoji(icon: string): string {
  // If icon is a URL (weatherapi.com), try to extract keyword
  const lower = icon.toLowerCase()
  if (lower.includes('sunny') || lower.includes('clear')) return WEATHER_EMOJI.sunny
  if (lower.includes('partly') || lower.includes('overcast')) return WEATHER_EMOJI.partly_cloudy
  if (lower.includes('cloud')) return WEATHER_EMOJI.cloudy
  if (lower.includes('rain') || lower.includes('drizzle')) return WEATHER_EMOJI.rain
  if (lower.includes('thunder') || lower.includes('storm')) return WEATHER_EMOJI.storm
  if (lower.includes('snow') || lower.includes('sleet')) return WEATHER_EMOJI.snow
  if (lower.includes('fog') || lower.includes('mist')) return WEATHER_EMOJI.fog
  return WEATHER_EMOJI[icon] ?? '\u{1F321}\u{FE0F}' // 🌡️ fallback
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ================================================================== */
/*  WeatherPanel                                                       */
/* ================================================================== */

export function WeatherPanel({ open, onClose }: WeatherPanelProps) {
  const [current, setCurrent] = useState<CurrentWeather | null>(null)
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchWeather = useCallback(async () => {
    setLoading(true)
    try {
      const [curRes, foreRes] = await Promise.all([
        fetch('/api/weather/current'),
        fetch('/api/weather/forecast'),
      ])
      if (curRes.ok) setCurrent(await curRes.json())
      if (foreRes.ok) setForecast(await foreRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (open) fetchWeather()
  }, [open, fetchWeather])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
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
        width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #333',
        }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>
            {'\u{1F324}\u{FE0F}'} Weather Station
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#aaa',
              fontSize: 20, cursor: 'pointer', lineHeight: 1,
            }}
          >x</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>Loading weather data...</div>}

          {/* Current Weather */}
          {current && !loading && (
            <div style={{
              background: '#16162a', border: '1px solid #333', borderRadius: 8,
              padding: '16px 20px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 48 }}>
                  {weatherEmoji(current.icon)}
                </span>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
                    {current.temp.toFixed(1)}&deg;C
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    {current.description}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12, marginTop: 16,
              }}>
                <WeatherStat label="Feels Like" value={`${current.feelsLike.toFixed(1)}\u00B0C`} />
                <WeatherStat label="Humidity" value={`${current.humidity}%`} />
                <WeatherStat label="Wind" value={`${current.windSpeed.toFixed(1)} m/s`} />
              </div>

              <div style={{ fontSize: 9, color: '#555', marginTop: 8, textAlign: 'right' }}>
                Updated at {formatTime(current.updatedAt)}
              </div>
            </div>
          )}

          {/* 5-Day Forecast */}
          {forecast && !loading && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#aaa' }}>
                5-Day Forecast
              </div>
              {forecast.days.map(day => (
                <div key={day.date} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', marginBottom: 4,
                  background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 6,
                }}>
                  <span style={{ fontSize: 10, color: '#aaa', minWidth: 72 }}>
                    {formatDate(day.date)}
                  </span>
                  <span style={{ fontSize: 20 }}>
                    {weatherEmoji(day.icon)}
                  </span>
                  <span style={{ fontSize: 11, color: '#ccc', flex: 1 }}>
                    {day.description}
                  </span>
                  <span style={{ fontSize: 11, color: '#4fc3f7', minWidth: 44, textAlign: 'right' }}>
                    {day.tempHigh.toFixed(0)}&deg;
                  </span>
                  <span style={{ fontSize: 11, color: '#888', minWidth: 44, textAlign: 'right' }}>
                    {day.tempLow.toFixed(0)}&deg;
                  </span>
                  <span style={{ fontSize: 10, color: '#64b5f6', minWidth: 36, textAlign: 'right' }}>
                    {'\u{1F4A7}'}{day.rainChance}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {!loading && !current && !forecast && (
            <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>
              No weather data available.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: '#ccc' }}>{value}</div>
    </div>
  )
}
