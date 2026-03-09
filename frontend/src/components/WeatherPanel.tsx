import { useState, useEffect, useCallback, useRef } from 'react'
import { createChart, type IChartApi, ColorType, LineSeries, LineType } from 'lightweight-charts'
import { useSocket } from '../hooks/useSocket'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface CurrentWeather {
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windDirection: number
  pressure: number
  uvIndex: number
  sunshineDuration: number
  solarRadiation: number
  par: number
  solarSource: 'nasa' | 'estimated' | ''
  vpd: number
  description: string
  icon: string
  location: string
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

interface ForecastPoint {
  time: string
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windDirection: number
  rainChance: number
  dewPoint: number
  vpd: number
}

interface ForecastResponse {
  location: string
  days: DayForecast[]
  points: ForecastPoint[]
  updatedAt: string
}

interface HourlyPoint {
  time: string
  temp: number
  humidity: number
  windSpeed: number
  windDirection: number
  vpd: number
}

interface TrendResponse {
  location: string
  past: HourlyPoint[]
  future: HourlyPoint[]
  updatedAt: string
}

interface WeatherConfig {
  provider: 'cwa' | 'weatherapi'
  cwaApiKey: string
  weatherApiKey: string
  defaultLocation: string
  defaultStationId?: string
}

interface StationItem {
  stationId: string
  stationName: string
  forecastLoc: string
  countyName: string
  townName: string
  lat: number
  lng: number
}

interface WeatherPanelProps {
  open: boolean
  onClose: () => void
}

type WeatherTab = 'overview' | 'trend'

/* ================================================================== */
/*  Preset locations                                                   */
/* ================================================================== */

const CWA_LOCATIONS = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
]

const WEATHERAPI_LOCATIONS = [
  { label: '台北 Taipei',       value: '25.0330,121.5654' },
  { label: '新北 New Taipei',   value: '25.0120,121.4650' },
  { label: '桃園 Taoyuan',      value: '24.9936,121.3010' },
  { label: '台中 Taichung',     value: '24.1477,120.6736' },
  { label: '台南 Tainan',       value: '22.9998,120.2270' },
  { label: '高雄 Kaohsiung',    value: '22.6273,120.3014' },
  { label: '基隆 Keelung',      value: '25.1276,121.7392' },
  { label: '新竹 Hsinchu',      value: '24.8038,120.9675' },
  { label: '嘉義 Chiayi',       value: '23.4801,120.4491' },
  { label: '花蓮 Hualien',      value: '23.9910,121.6115' },
  { label: '台東 Taitung',      value: '22.7583,121.1444' },
  { label: '宜蘭 Yilan',        value: '24.7570,121.7533' },
]

const STORAGE_KEY = 'weather-location'

function loadSavedLocation(): string {
  try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}

function saveLocation(loc: string) {
  try { localStorage.setItem(STORAGE_KEY, loc) } catch { /* ignore */ }
}

/* ================================================================== */
/*  Weather icon mapping                                               */
/* ================================================================== */

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '\u{2600}\u{FE0F}',
  clear: '\u{1F31F}',
  partly_cloudy: '\u{26C5}',
  cloudy: '\u{2601}\u{FE0F}',
  rain: '\u{1F327}\u{FE0F}',
  light_rain: '\u{1F326}\u{FE0F}',
  storm: '\u{26C8}\u{FE0F}',
  snow: '\u{2744}\u{FE0F}',
  fog: '\u{1F32B}\u{FE0F}',
}

function weatherEmoji(icon: string): string {
  const lower = icon.toLowerCase()
  if (lower.includes('sunny') || lower.includes('clear') || lower.includes('\u6674')) return WEATHER_EMOJI.sunny
  if (lower.includes('partly') || lower.includes('overcast') || lower.includes('\u591A\u96F2')) return WEATHER_EMOJI.partly_cloudy
  if (lower.includes('cloud') || lower.includes('\u9670')) return WEATHER_EMOJI.cloudy
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('\u96E8')) return WEATHER_EMOJI.rain
  if (lower.includes('thunder') || lower.includes('storm') || lower.includes('\u96F7')) return WEATHER_EMOJI.storm
  if (lower.includes('snow') || lower.includes('sleet') || lower.includes('\u96EA')) return WEATHER_EMOJI.snow
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('\u9727')) return WEATHER_EMOJI.fog
  return WEATHER_EMOJI[icon] ?? '\u{1F321}\u{FE0F}'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
}

function windDirLabel(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16] ?? 'N'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ================================================================== */
/*  Inline styles                                                      */
/* ================================================================== */

const inputStyle: React.CSSProperties = {
  background: '#16162a', border: '1px solid #333', borderRadius: 4,
  color: '#ccc', fontSize: 12, padding: '5px 8px', width: '100%',
  fontFamily: 'monospace', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#888', marginBottom: 4, display: 'block',
}

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#3a6ea5' : 'transparent',
  border: 'none', borderRadius: 4,
  color: active ? '#fff' : '#888',
  fontSize: 11, padding: '4px 12px', cursor: 'pointer',
  fontFamily: 'monospace',
})

/* ================================================================== */
/*  TrendChart (Lightweight Charts)                                    */
/* ================================================================== */

const CHART_WIDTH = 1218 // panel width (1250) - padding (2*16)

/** Deduplicate by time, sort ascending, filter invalid timestamps */
function sanitizeSeries(
  points: HourlyPoint[],
  valueFn: (p: HourlyPoint) => number,
): { time: number; value: number }[] {
  const seen = new Set<number>()
  const result: { time: number; value: number }[] = []
  for (const p of points) {
    const ts = Math.floor(new Date(p.time).getTime() / 1000)
    if (!ts || isNaN(ts) || seen.has(ts)) continue
    const v = valueFn(p)
    if (isNaN(v)) continue
    seen.add(ts)
    result.push({ time: ts, value: v })
  }
  result.sort((a, b) => a.time - b.time)
  return result
}

function TrendChart({ trend }: { trend: TrendResponse }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Clean up any previous chart
    if (chartRef.current) {
      try { chartRef.current.remove() } catch { /* ignore */ }
      chartRef.current = null
    }
    setError(null)

    try {
      const chart = createChart(el, {
        width: CHART_WIDTH,
        height: 280,
        layout: {
          background: { type: ColorType.Solid, color: '#16162a' },
          textColor: '#888',
          fontFamily: 'monospace',
          fontSize: 10,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#333',
        },
        rightPriceScale: {
          visible: true,
          borderColor: '#333',
        },
      })
      chartRef.current = chart

      const curved = { lineType: LineType.Curved, lastValueVisible: false }

      // Track all series for crosshair tooltip
      const seriesMeta: { series: ReturnType<typeof chart.addSeries>; label: string; unit: string; color: string }[] = []

      // Past temperature line
      const pastTemp = sanitizeSeries(trend.past, p => p.temp)
      if (pastTemp.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#4fc3f7', lineWidth: 2, title: 'Temp (obs)', ...curved })
        s.setData(pastTemp as any)
        seriesMeta.push({ series: s, label: 'Temp (obs)', unit: '°C', color: '#4fc3f7' })
      }

      // Future temperature line
      const futureTemp = sanitizeSeries(trend.future, p => p.temp)
      if (futureTemp.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#ff9800', lineWidth: 2, lineStyle: 2, title: 'Temp (fc)', ...curved })
        s.setData(futureTemp as any)
        seriesMeta.push({ series: s, label: 'Temp (fc)', unit: '°C', color: '#ff9800' })
      }

      // Humidity line
      const pastHum = sanitizeSeries(trend.past.filter(p => p.humidity > 0), p => p.humidity)
      if (pastHum.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#64b5f6', lineWidth: 1, priceScaleId: 'humidity', title: 'Humidity', ...curved })
        s.priceScale().applyOptions({ visible: false })
        s.setData(pastHum as any)
        seriesMeta.push({ series: s, label: 'Humidity', unit: '%', color: '#64b5f6' })
      }

      // VPD line
      const allVpd = sanitizeSeries([...trend.past, ...trend.future].filter(p => p.vpd > 0), p => p.vpd)
      if (allVpd.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#81c784', lineWidth: 1, priceScaleId: 'vpd', title: 'VPD', ...curved })
        s.priceScale().applyOptions({ visible: false })
        s.setData(allVpd as any)
        seriesMeta.push({ series: s, label: 'VPD', unit: 'kPa', color: '#81c784' })
      }

      // Wind speed line
      const allWind = sanitizeSeries([...trend.past, ...trend.future].filter(p => p.windSpeed > 0), p => p.windSpeed)
      if (allWind.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#e0e0e0', lineWidth: 1, lineStyle: 1, priceScaleId: 'wind', title: 'Wind', ...curved })
        s.priceScale().applyOptions({ visible: false })
        s.setData(allWind as any)
        seriesMeta.push({ series: s, label: 'Wind', unit: 'm/s', color: '#e0e0e0' })
      }

      // Crosshair tooltip
      const tooltip = document.createElement('div')
      Object.assign(tooltip.style, {
        position: 'absolute', top: '8px', left: '8px', zIndex: '10',
        background: 'rgba(22,22,42,0.92)', border: '1px solid #444', borderRadius: '4px',
        padding: '6px 10px', fontSize: '11px', fontFamily: 'monospace',
        color: '#ccc', pointerEvents: 'none', display: 'none', lineHeight: '1.6',
      })
      el.style.position = 'relative'
      el.appendChild(tooltip)

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || param.seriesData.size === 0) {
          tooltip.style.display = 'none'
          return
        }
        const lines: string[] = []
        for (const m of seriesMeta) {
          const d = param.seriesData.get(m.series) as any
          if (d && d.value != null) {
            lines.push(`<span style="color:${m.color}">\u25CF</span> ${m.label}: ${d.value.toFixed(1)} ${m.unit}`)
          }
        }
        if (lines.length > 0) {
          tooltip.innerHTML = lines.join('<br>')
          tooltip.style.display = 'block'
        } else {
          tooltip.style.display = 'none'
        }
      })

      chart.timeScale().fitContent()
    } catch (e) {
      console.error('TrendChart error:', e)
      setError(String((e as Error).message ?? e))
    }

    return () => {
      if (chartRef.current) {
        try { chartRef.current.remove() } catch { /* ignore */ }
        chartRef.current = null
      }
    }
  }, [trend])

  if (trend.past.length === 0 && trend.future.length === 0) {
    return <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>No trend data available.</div>
  }

  if (error) {
    return <div style={{ color: '#f44', textAlign: 'center', padding: 24 }}>Chart error: {error}</div>
  }

  return (
    <div ref={containerRef} style={{ borderRadius: 6, overflow: 'hidden', background: '#16162a', minHeight: 280 }} />
  )
}

/* ================================================================== */
/*  ForecastChart (Lightweight Charts)                                 */
/* ================================================================== */

/** Deduplicate ForecastPoint[] by time */
function sanitizeFcSeries(
  points: ForecastPoint[],
  valueFn: (p: ForecastPoint) => number,
): { time: number; value: number }[] {
  const seen = new Set<number>()
  const result: { time: number; value: number }[] = []
  for (const p of points) {
    const ts = Math.floor(new Date(p.time).getTime() / 1000)
    if (!ts || isNaN(ts) || seen.has(ts)) continue
    const v = valueFn(p)
    if (isNaN(v)) continue
    seen.add(ts)
    result.push({ time: ts, value: v })
  }
  result.sort((a, b) => a.time - b.time)
  return result
}

function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (chartRef.current) {
      try { chartRef.current.remove() } catch { /* ignore */ }
      chartRef.current = null
    }
    setError(null)

    try {
      const chart = createChart(el, {
        width: CHART_WIDTH,
        height: 260,
        layout: {
          background: { type: ColorType.Solid, color: '#16162a' },
          textColor: '#888',
          fontFamily: 'monospace',
          fontSize: 10,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#333' },
        rightPriceScale: { visible: true, borderColor: '#333' },
      })
      chartRef.current = chart
      const curved = { lineType: LineType.Curved, lastValueVisible: false }
      const seriesMeta: { series: ReturnType<typeof chart.addSeries>; label: string; unit: string; color: string }[] = []

      // Temperature
      const temp = sanitizeFcSeries(points, p => p.temp)
      if (temp.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#ef5350', lineWidth: 2, title: 'Temp', ...curved })
        s.setData(temp as any)
        seriesMeta.push({ series: s, label: 'Temp', unit: '°C', color: '#ef5350' })
      }

      // Feels-like
      const fl = sanitizeFcSeries(points.filter(p => p.feelsLike > 0), p => p.feelsLike)
      if (fl.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#ff8a65', lineWidth: 1, lineStyle: 2, title: 'Feels', ...curved })
        s.setData(fl as any)
        seriesMeta.push({ series: s, label: 'Feels', unit: '°C', color: '#ff8a65' })
      }

      // Dew point
      const dp = sanitizeFcSeries(points.filter(p => p.dewPoint !== 0), p => p.dewPoint)
      if (dp.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#80cbc4', lineWidth: 1, lineStyle: 1, title: 'Dew', ...curved })
        s.setData(dp as any)
        seriesMeta.push({ series: s, label: 'Dew', unit: '°C', color: '#80cbc4' })
      }

      // Humidity
      const hum = sanitizeFcSeries(points.filter(p => p.humidity > 0), p => p.humidity)
      if (hum.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#64b5f6', lineWidth: 1, priceScaleId: 'rh', title: 'Humidity', ...curved })
        s.priceScale().applyOptions({ visible: false })
        s.setData(hum as any)
        seriesMeta.push({ series: s, label: 'Humidity', unit: '%', color: '#64b5f6' })
      }

      // Rain chance
      const rain = sanitizeFcSeries(points.filter(p => p.rainChance > 0), p => p.rainChance)
      if (rain.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#29b6f6', lineWidth: 1, lineStyle: 2, priceScaleId: 'rain', title: 'Rain', ...curved })
        s.priceScale().applyOptions({ visible: false })
        s.setData(rain as any)
        seriesMeta.push({ series: s, label: 'Rain', unit: '%', color: '#29b6f6' })
      }

      // Wind speed
      const ws = sanitizeFcSeries(points.filter(p => p.windSpeed > 0), p => p.windSpeed)
      if (ws.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#e0e0e0', lineWidth: 1, lineStyle: 1, priceScaleId: 'wind', title: 'Wind', ...curved })
        s.priceScale().applyOptions({ visible: false })
        s.setData(ws as any)
        seriesMeta.push({ series: s, label: 'Wind', unit: 'm/s', color: '#e0e0e0' })
      }

      // VPD
      const vpd = sanitizeFcSeries(points.filter(p => p.vpd > 0), p => p.vpd)
      if (vpd.length > 0) {
        const s = chart.addSeries(LineSeries, { color: '#ce93d8', lineWidth: 1, priceScaleId: 'vpd', title: 'VPD', ...curved })
        s.priceScale().applyOptions({ visible: false })
        s.setData(vpd as any)
        seriesMeta.push({ series: s, label: 'VPD', unit: 'kPa', color: '#ce93d8' })
      }

      // Crosshair tooltip
      const tooltip = document.createElement('div')
      Object.assign(tooltip.style, {
        position: 'absolute', top: '8px', left: '8px', zIndex: '10',
        background: 'rgba(22,22,42,0.92)', border: '1px solid #444', borderRadius: '4px',
        padding: '6px 10px', fontSize: '11px', fontFamily: 'monospace',
        color: '#ccc', pointerEvents: 'none', display: 'none', lineHeight: '1.6',
      })
      el.style.position = 'relative'
      el.appendChild(tooltip)

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || param.seriesData.size === 0) {
          tooltip.style.display = 'none'
          return
        }
        const lines: string[] = []
        for (const m of seriesMeta) {
          const d = param.seriesData.get(m.series) as any
          if (d && d.value != null) {
            lines.push(`<span style="color:${m.color}">\u25CF</span> ${m.label}: ${d.value.toFixed(1)} ${m.unit}`)
          }
        }
        if (lines.length > 0) {
          tooltip.innerHTML = lines.join('<br>')
          tooltip.style.display = 'block'
        } else {
          tooltip.style.display = 'none'
        }
      })

      chart.timeScale().fitContent()
    } catch (e) {
      console.error('ForecastChart error:', e)
      setError(String((e as Error).message ?? e))
    }

    return () => {
      if (chartRef.current) {
        try { chartRef.current.remove() } catch { /* ignore */ }
        chartRef.current = null
      }
    }
  }, [points])

  if (points.length === 0) {
    return <div style={{ color: '#666', textAlign: 'center', padding: 16 }}>No forecast chart data.</div>
  }
  if (error) {
    return <div style={{ color: '#f44', textAlign: 'center', padding: 16 }}>Forecast chart error: {error}</div>
  }

  return (
    <div ref={containerRef} style={{ borderRadius: 6, overflow: 'hidden', background: '#16162a', minHeight: 260 }} />
  )
}

/* ================================================================== */
/*  WeatherPanel                                                       */
/* ================================================================== */

export function WeatherPanel({ open, onClose }: WeatherPanelProps) {
  const [current, setCurrent] = useState<CurrentWeather | null>(null)
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [trend, setTrend] = useState<TrendResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState(loadSavedLocation)
  const [showSettings, setShowSettings] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [config, setConfig] = useState<WeatherConfig | null>(null)
  const [tab, setTab] = useState<WeatherTab>('overview')

  // Station list for cascading dropdown
  const [allStations, setAllStations] = useState<StationItem[]>([])
  const [selectedStation, setSelectedStation] = useState<string>('')  // stationId

  // Editing state for settings
  const [editProvider, setEditProvider] = useState<WeatherConfig['provider']>('cwa')
  const [editCwaKey, setEditCwaKey] = useState('')
  const [editWeatherApiKey, setEditWeatherApiKey] = useState('')
  const [editDefaultLoc, setEditDefaultLoc] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/weather/config')
      if (res.ok) {
        const cfg: WeatherConfig = await res.json()
        setConfig(cfg)
        setEditProvider(cfg.provider)
        setEditCwaKey(cfg.cwaApiKey)
        setEditWeatherApiKey(cfg.weatherApiKey)
        setEditDefaultLoc(cfg.defaultLocation)
        if (!location) {
          setLocation(cfg.defaultLocation)
          saveLocation(cfg.defaultLocation)
        }
        // Auto-select default station from .env GPS (only if no station already selected)
        if (cfg.defaultStationId) {
          setSelectedStation(prev => prev || cfg.defaultStationId!)
        }
      }
    } catch { /* ignore */ }
  }, [location])

  const fetchStations = useCallback(async () => {
    try {
      const res = await fetch('/api/weather/stations')
      if (res.ok) {
        const list: StationItem[] = await res.json()
        setAllStations(list)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchWeather = useCallback(async (loc: string, sid?: string) => {
    setLoading(true)
    try {
      let qs = `?location=${encodeURIComponent(loc)}`
      if (sid) qs += `&stationId=${encodeURIComponent(sid)}`
      const [curRes, foreRes, trendRes] = await Promise.all([
        fetch(`/api/weather/current${qs}`),
        fetch(`/api/weather/forecast?location=${encodeURIComponent(loc)}`),  // forecast is county-level only
        fetch(`/api/weather/trend${qs}`),
      ])
      if (curRes.ok) setCurrent(await curRes.json())
      if (foreRes.ok) setForecast(await foreRes.json())
      if (trendRes.ok) setTrend(await trendRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (open) {
      fetchConfig()
      fetchStations()
    }
  }, [open, fetchConfig, fetchStations])

  useEffect(() => {
    if (open && location) fetchWeather(location, selectedStation || undefined)
  }, [open, location, selectedStation, fetchWeather])

  // Update stationInfo when location or allStations changes
  useEffect(() => {
    if (allStations.length === 0 || !location) { setStationInfo(null); return }
    // If a specific station is selected, use it; otherwise match by forecastLoc
    if (!selectedStation) { setStationInfo(null); return }
    const match = allStations.find(s => s.stationId === selectedStation)
    if (match) setStationInfo({ name: match.stationName, lat: match.lat, lng: match.lng })
    else setStationInfo(null)
  }, [location, allStations, selectedStation])

  // Listen for real-time forecast updates via WebSocket
  const socket = useSocket()
  useEffect(() => {
    const handler = () => {
      if (location) fetchWeather(location, selectedStation || undefined)
    }
    socket.on('weather:forecastUpdated', handler)
    return () => { socket.off('weather:forecastUpdated', handler) }
  }, [socket, location, selectedStation, fetchWeather])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleLocationChange = (val: string) => {
    setLocation(val)
    saveLocation(val)
  }

  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsInfo, setGpsInfo] = useState<string | null>(null)
  const [stationInfo, setStationInfo] = useState<{ name: string; lat: number; lng: number } | null>(null)

  const handleGpsLocate = () => {
    if (!navigator.geolocation) { setGpsInfo('Geolocation not supported'); return }
    setGpsLoading(true)
    setGpsInfo(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/weather/nearest?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
          if (res.ok) {
            const data = await res.json()
            handleLocationChange(data.location)
            if (data.stationId) setSelectedStation(data.stationId)
            const name = data.stationName || data.location
            const town = data.townName ? ` ${data.townName}` : ''
            setGpsInfo(`${name}${town} (${data.distanceKm} km)`)
          }
        } catch { setGpsInfo('GPS lookup failed') }
        finally { setGpsLoading(false) }
      },
      (err) => { setGpsInfo(`GPS error: ${err.message}`); setGpsLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/weather/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: editProvider,
          cwaApiKey: editCwaKey,
          weatherApiKey: editWeatherApiKey,
          defaultLocation: editDefaultLoc,
        }),
      })
      if (res.ok) {
        const cfg: WeatherConfig = await res.json()
        setConfig(cfg)
        setShowSettings(false)
        if (location) fetchWeather(location, selectedStation || undefined)
      }
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  if (!open) return null

  const isCwa = config?.provider === 'cwa'

  const locationLabel = isCwa
    ? (CWA_LOCATIONS.includes(location) ? location : (current?.location ?? location))
    : (WEATHERAPI_LOCATIONS.find(l => l.value === location)?.label ?? current?.location ?? location)

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
        width: 1250, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #333',
        }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>
            {'\u{1F324}\u{FE0F}'} Weather Station
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => { setShowInfo(!showInfo); setShowSettings(false) }}
              title="Data Sources & Field Descriptions"
              style={{
                background: showInfo ? '#3a6ea5' : 'none',
                border: 'none', color: showInfo ? '#fff' : '#aaa',
                fontSize: 14, cursor: 'pointer', borderRadius: 4,
                padding: '2px 7px', lineHeight: 1, fontWeight: 'bold',
                fontFamily: 'monospace',
              }}
            >?</button>
            <button
              onClick={() => { setShowSettings(!showSettings); setShowInfo(false) }}
              title="Settings"
              style={{
                background: showSettings ? '#3a6ea5' : 'none',
                border: 'none', color: showSettings ? '#fff' : '#aaa',
                fontSize: 16, cursor: 'pointer', borderRadius: 4,
                padding: '2px 6px', lineHeight: 1,
              }}
            >{'\u{2699}\u{FE0F}'}</button>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#aaa',
                fontSize: 20, cursor: 'pointer', lineHeight: 1,
              }}
            >x</button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #333',
            background: '#16162a',
          }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 10, color: '#aaa' }}>
              {'\u{2699}\u{FE0F}'} Settings
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Data Provider</label>
                <select
                  value={editProvider}
                  onChange={e => setEditProvider(e.target.value as WeatherConfig['provider'])}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="cwa">CWA Central Weather Administration</option>
                  <option value="weatherapi">weatherapi.com</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>
                  {editProvider === 'cwa' ? 'CWA Authorization Key' : 'weatherapi.com API Key'}
                </label>
                <input
                  value={editProvider === 'cwa' ? editCwaKey : editWeatherApiKey}
                  onChange={e => editProvider === 'cwa' ? setEditCwaKey(e.target.value) : setEditWeatherApiKey(e.target.value)}
                  placeholder={editProvider === 'cwa' ? 'CWA-XXXXXXXX-...' : 'your-api-key'}
                  style={inputStyle}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Default Location</label>
                <input
                  value={editDefaultLoc}
                  onChange={e => setEditDefaultLoc(e.target.value)}
                  placeholder={editProvider === 'cwa' ? '臺北市' : 'City or lat,lng'}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{
                    background: '#333', border: 'none', borderRadius: 4,
                    color: '#aaa', fontSize: 12, padding: '6px 14px', cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >Cancel</button>
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  style={{
                    background: '#3a6ea5', border: 'none', borderRadius: 4,
                    color: '#fff', fontSize: 12, padding: '6px 14px', cursor: 'pointer',
                    opacity: saving ? 0.6 : 1, whiteSpace: 'nowrap',
                  }}
                >{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Info Panel */}
        {showInfo && (
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #333',
            background: '#16162a', maxHeight: 300, overflowY: 'auto',
          }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 10, color: '#aaa' }}>
              Field Descriptions & Data Sources
            </div>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', color: '#ccc' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', width: 130 }}>Field</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Description</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', width: 140 }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Temp / Feels Like', 'Air temperature (°C)', 'CWA / weatherapi'],
                  ['Humidity', 'Relative humidity (%)', 'CWA / weatherapi'],
                  ['VPD', 'Vapor Pressure Deficit (kPa) — calculated from temp & humidity. Ideal for plants: 0.4–1.6 kPa', 'Calculated'],
                  ['Pressure', 'Atmospheric pressure (hPa)', 'CWA / weatherapi'],
                  ['Wind / Wind Dir', 'Wind speed (m/s) and direction (degrees)', 'CWA / weatherapi'],
                  ['UV Index', 'Ultraviolet radiation index (0–11+)', 'CWA / weatherapi'],
                  ['Sunshine', 'Sunshine duration (hours today)', 'CWA only'],
                  ['GHI', 'Global Horizontal Irradiance (W/m²) — total solar energy on horizontal surface', 'NASA POWER satellite / Estimated from sunshine (Angström)'],
                  ['PAR', 'Photosynthetically Active Radiation (µmol/m²/s) — light usable by plants (400–700nm). Derived from GHI × 0.45 × 4.57', 'NASA POWER / Estimated'],
                  ['Rain %', 'Probability of precipitation (%)', 'CWA forecast / weatherapi'],
                ].map(([field, desc, src]) => (
                  <tr key={field} style={{ borderBottom: '1px solid #2a2a3e' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 'bold', color: '#4fc3f7', whiteSpace: 'nowrap' }}>{field}</td>
                    <td style={{ padding: '5px 8px' }}>{desc}</td>
                    <td style={{ padding: '5px 8px', fontSize: 10, color: '#888' }}>{src}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 10, color: '#666', marginTop: 10 }}>
              {'\u{1F6F0}'} = NASA POWER satellite data (1–7 day lag) &nbsp;|&nbsp;
              ~ = Estimated from CWA sunshine duration
            </div>
          </div>
        )}

        {/* Location + Tab bar */}
        <div style={{
          padding: '8px 16px', borderBottom: '1px solid #2a2a3e',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 11, color: '#888' }}>{'\u{1F4CD}'}</span>
          {isCwa ? (<>
            {/* County dropdown */}
            <select
              value={CWA_LOCATIONS.includes(location) ? location : ''}
              onChange={e => {
                handleLocationChange(e.target.value)
                setSelectedStation('')
              }}
              style={{
                background: '#16162a', border: '1px solid #333', borderRadius: 4,
                color: '#ccc', fontSize: 12, padding: '4px 8px', width: 100,
                fontFamily: 'monospace', cursor: 'pointer',
              }}
            >
              {!CWA_LOCATIONS.includes(location) && (
                <option value="" disabled>Select city...</option>
              )}
              {CWA_LOCATIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {/* Station dropdown (filtered by selected county) */}
            {(() => {
              const countyStations = allStations.filter(s => s.forecastLoc === location || s.countyName === location)
              if (countyStations.length <= 1) return null
              return (
                <select
                  value={selectedStation}
                  onChange={e => {
                    setSelectedStation(e.target.value)
                  }}
                  style={{
                    background: '#16162a', border: '1px solid #333', borderRadius: 4,
                    color: '#ccc', fontSize: 12, padding: '4px 8px', width: 140,
                    fontFamily: 'monospace', cursor: 'pointer',
                  }}
                >
                  <option value="">All stations</option>
                  {countyStations.map(s => (
                    <option key={s.stationId} value={s.stationId}>
                      {s.stationName} ({s.townName})
                    </option>
                  ))}
                </select>
              )
            })()}
          </>) : (
            <select
              value={WEATHERAPI_LOCATIONS.some(l => l.value === location) ? location : '__custom__'}
              onChange={e => {
                if (e.target.value === '__custom__') return
                handleLocationChange(e.target.value)
              }}
              style={{
                background: '#16162a', border: '1px solid #333', borderRadius: 4,
                color: '#ccc', fontSize: 12, padding: '4px 8px', width: 160,
                fontFamily: 'monospace', cursor: 'pointer',
              }}
            >
              {WEATHERAPI_LOCATIONS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
              <option value="__custom__">Custom...</option>
            </select>
          )}
          <button
            onClick={() => { if (location) fetchWeather(location, selectedStation || undefined) }}
            title="Refresh"
            style={{
              background: 'none', border: '1px solid #333', borderRadius: 4,
              color: '#aaa', fontSize: 12, padding: '3px 8px', cursor: 'pointer',
            }}
          >{'\u{1F504}'}</button>
          <button
            onClick={handleGpsLocate}
            disabled={gpsLoading}
            title="Use GPS to find nearest station"
            style={{
              background: 'none', border: '1px solid #333', borderRadius: 4,
              color: gpsLoading ? '#555' : '#aaa', fontSize: 12, padding: '3px 8px', cursor: 'pointer',
            }}
          >{gpsLoading ? '\u{23F3}' : '\u{1F4E1}'} GPS</button>
          {gpsInfo && <span style={{ fontSize: 10, color: '#6a6' }}>{gpsInfo}</span>}

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', gap: 4 }}>
            <button style={tabBtnStyle(tab === 'overview')} onClick={() => setTab('overview')}>Overview</button>
            <button style={tabBtnStyle(tab === 'trend')} onClick={() => setTab('trend')}>Trend</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>Loading weather data...</div>}

          {/* === Overview Tab: Current + Forecast side by side === */}
          {tab === 'overview' && !loading && (
            <div style={{ display: 'flex', gap: 16 }}>
              {/* Left: Current weather */}
              <div style={{ flex: 1 }}>
                {current ? (
                  <div style={{
                    background: '#16162a', border: '1px solid #333', borderRadius: 8,
                    padding: '16px 20px', height: '100%', boxSizing: 'border-box',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 56 }}>
                        {weatherEmoji(current.icon)}
                      </span>
                      <div>
                        <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fff' }}>
                          {current.temp.toFixed(1)}&deg;C
                        </div>
                        <div style={{ fontSize: 13, color: '#aaa' }}>
                          {current.description}
                        </div>
                        <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                          {locationLabel}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                      gap: 10, marginTop: 20,
                    }}>
                      <WeatherStat label="Feels Like" value={`${current.feelsLike.toFixed(1)}\u00B0C`} />
                      <WeatherStat label="Humidity" value={`${current.humidity}%`} />
                      <WeatherStat label="VPD" value={`${current.vpd.toFixed(2)} kPa`} />
                      <WeatherStat label="Pressure" value={`${current.pressure.toFixed(0)} hPa`} />
                      <WeatherStat label="UV Index" value={`${current.uvIndex}`} />
                      <WeatherStat label="Wind" value={`${current.windSpeed.toFixed(1)} m/s`} />
                      <WeatherStat label="Wind Dir" value={`${windDirLabel(current.windDirection)} ${current.windDirection}\u00B0`} />
                      <WeatherStat label="Sunshine" value={`${current.sunshineDuration.toFixed(1)} hr`} />
                      <WeatherStat
                        label={`GHI${current.solarSource === 'nasa' ? ' \u{1F6F0}' : current.solarSource === 'estimated' ? ' ~' : ''}`}
                        value={current.solarRadiation > 0 ? `${current.solarRadiation} W/m\u00B2` : '--'}
                      />
                      <WeatherStat
                        label={`PAR${current.solarSource === 'nasa' ? ' \u{1F6F0}' : current.solarSource === 'estimated' ? ' ~' : ''}`}
                        value={current.par > 0 ? `${current.par} \u00B5mol/m\u00B2/s` : '--'}
                      />
                    </div>

                    <div style={{ fontSize: 9, color: '#555', marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#6a6' }}>
                        {stationInfo
                          ? `${stationInfo.name} @ ${stationInfo.lat.toFixed(4)}, ${stationInfo.lng.toFixed(4)}`
                          : ''}
                      </span>
                      <span>
                        Updated {formatTime(current.updatedAt)}
                        {config && (
                          <span style={{ marginLeft: 8 }}>
                            via {config.provider === 'cwa' ? 'CWA' : 'weatherapi.com'}
                          </span>
                        )}
                        {current.solarSource && (
                          <span style={{ marginLeft: 8 }}>
                            Solar: {current.solarSource === 'nasa' ? 'NASA POWER' : 'Estimated'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: '#16162a', border: '1px solid #333', borderRadius: 8,
                    padding: 24, textAlign: 'center', color: '#666',
                  }}>
                    No current weather data.
                  </div>
                )}
              </div>

              {/* Right: Forecast */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 'bold' }}>
                  Forecast
                </div>
                {forecast && forecast.days.length > 0 ? (
                  <div>
                    {forecast.days.map(day => (
                      <div key={day.date} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 12px', marginBottom: 4,
                        background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 6,
                      }}>
                        <span style={{ fontSize: 10, color: '#aaa', minWidth: 80 }}>
                          {formatDate(day.date)}
                        </span>
                        <span style={{ fontSize: 22 }}>
                          {weatherEmoji(day.icon)}
                        </span>
                        <span style={{ fontSize: 11, color: '#ccc', flex: 1 }}>
                          {day.description}
                        </span>
                        <span style={{ fontSize: 12, color: '#4fc3f7', minWidth: 36, textAlign: 'right' }}>
                          {day.tempHigh.toFixed(0)}&deg;
                        </span>
                        <span style={{ fontSize: 12, color: '#888', minWidth: 36, textAlign: 'right' }}>
                          {day.tempLow.toFixed(0)}&deg;
                        </span>
                        <span style={{ fontSize: 10, color: '#64b5f6', minWidth: 40, textAlign: 'right' }}>
                          {'\u{1F4A7}'}{day.rainChance}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    background: '#16162a', border: '1px solid #333', borderRadius: 8,
                    padding: 24, textAlign: 'center', color: '#666',
                  }}>
                    No forecast data available.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === Trend Tab === */}
          {tab === 'trend' && !loading && (
            <div>
              {/* Observation trend chart */}
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 'bold' }}>
                Observation Trend (Past)
              </div>
              {trend ? <TrendChart trend={trend} /> : (
                <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>No observation trend data.</div>
              )}

              {/* Forecast trend chart */}
              <div style={{ fontSize: 12, color: '#888', marginTop: 20, marginBottom: 8, fontWeight: 'bold' }}>
                Forecast Trend
              </div>
              {forecast && forecast.points.length > 0 ? (
                <ForecastChart points={forecast.points} />
              ) : (
                <div style={{ color: '#666', textAlign: 'center', padding: 24 }}>No forecast chart data.</div>
              )}
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
