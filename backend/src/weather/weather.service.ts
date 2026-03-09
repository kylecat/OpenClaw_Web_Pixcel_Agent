import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { EventsGateway } from '../events/events.gateway.js'
import { DatabaseService } from '../database/database.service.js'

/* ------------------------------------------------------------------ */
/*  Domain interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface CurrentWeather {
  temp: number          // Celsius
  feelsLike: number
  humidity: number      // %
  windSpeed: number     // m/s
  windDirection: number // degrees (0=N, 90=E, 180=S, 270=W)
  pressure: number      // hPa
  uvIndex: number
  sunshineDuration: number // hours (CWA)
  solarRadiation: number   // W/m² — GHI (Global Horizontal Irradiance)
  par: number              // µmol/m²/s — Photosynthetically Active Radiation
  solarSource: 'nasa' | 'estimated' | '' // data source indicator
  vpd: number           // kPa — Vapor Pressure Deficit
  description: string
  icon: string
  location: string
  updatedAt: string
}

export interface DayForecast {
  date: string          // YYYY-MM-DD
  tempHigh: number
  tempLow: number
  description: string
  icon: string
  rainChance: number    // 0-100 %
}

/** Per-period forecast point for trend chart (3-hour resolution) */
export interface ForecastPoint {
  time: string          // ISO datetime
  temp: number          // °C — point temperature
  feelsLike: number     // °C — apparent temperature
  humidity: number
  windSpeed: number
  windDirection: number // degrees
  rainChance: number    // 0-100 %
  dewPoint: number      // °C
  vpd: number
}

export interface ForecastResponse {
  location: string
  days: DayForecast[]
  points: ForecastPoint[]  // detailed per-period data for chart
  updatedAt: string
}

export interface HourlyPoint {
  time: string          // ISO or 'HH:mm'
  temp: number
  humidity: number
  windSpeed: number
  windDirection: number
  vpd: number           // kPa
}

export interface TrendResponse {
  location: string
  past: HourlyPoint[]       // past 24h observed
  future: HourlyPoint[]     // forecast hourly (if available)
  updatedAt: string
}

export interface WeatherConfig {
  provider: 'cwa' | 'weatherapi'
  cwaApiKey: string
  weatherApiKey: string
  defaultLocation: string
  defaultStationId?: string
}

/* ------------------------------------------------------------------ */
/*  CWA location mapping (city name → station / location ID)           */
/* ------------------------------------------------------------------ */

interface StationInfo {
  stationId: string
  stationName: string   // e.g. "臺北", "阿里山", "崇德"
  forecastLoc: string   // county name for forecast API (e.g. "臺北市")
  countyName: string    // county from CWA metadata
  townName: string      // township from CWA metadata
  lat: number
  lng: number
}

/** Default county-level stations (fallback before API data loads) */
const DEFAULT_STATIONS: StationInfo[] = [
  { stationId: '466920', stationName: '臺北', forecastLoc: '臺北市', countyName: '臺北市', townName: '中正區', lat: 25.04, lng: 121.51 },
  { stationId: '466881', stationName: '新北', forecastLoc: '新北市', countyName: '新北市', townName: '新店區', lat: 25.01, lng: 121.47 },
  { stationId: '467050', stationName: '桃園', forecastLoc: '桃園市', countyName: '桃園市', townName: '桃園區', lat: 24.99, lng: 121.30 },
  { stationId: '467490', stationName: '臺中', forecastLoc: '臺中市', countyName: '臺中市', townName: '北區', lat: 24.15, lng: 120.67 },
  { stationId: '467410', stationName: '臺南', forecastLoc: '臺南市', countyName: '臺南市', townName: '中西區', lat: 23.00, lng: 120.23 },
  { stationId: '467440', stationName: '高雄', forecastLoc: '高雄市', countyName: '高雄市', townName: '前鎮區', lat: 22.63, lng: 120.30 },
  { stationId: '466940', stationName: '基隆', forecastLoc: '基隆市', countyName: '基隆市', townName: '仁愛區', lat: 25.13, lng: 121.74 },
  { stationId: '467571', stationName: '新竹', forecastLoc: '新竹縣', countyName: '新竹縣', townName: '竹北市', lat: 24.80, lng: 120.97 },
  { stationId: '467480', stationName: '嘉義', forecastLoc: '嘉義市', countyName: '嘉義市', townName: '西區', lat: 23.48, lng: 120.45 },
  { stationId: '467590', stationName: '恆春', forecastLoc: '屏東縣', countyName: '屏東縣', townName: '恆春鎮', lat: 22.00, lng: 120.75 },
  { stationId: '467080', stationName: '宜蘭', forecastLoc: '宜蘭縣', countyName: '宜蘭縣', townName: '宜蘭市', lat: 24.76, lng: 121.75 },
  { stationId: '466990', stationName: '花蓮', forecastLoc: '花蓮縣', countyName: '花蓮縣', townName: '花蓮市', lat: 23.99, lng: 121.61 },
  { stationId: '467660', stationName: '臺東', forecastLoc: '臺東縣', countyName: '臺東縣', townName: '臺東市', lat: 22.76, lng: 121.14 },
  { stationId: '467350', stationName: '澎湖', forecastLoc: '澎湖縣', countyName: '澎湖縣', townName: '馬公市', lat: 23.57, lng: 119.58 },
  { stationId: '467110', stationName: '金門', forecastLoc: '金門縣', countyName: '金門縣', townName: '金城鎮', lat: 24.45, lng: 118.32 },
  { stationId: '467990', stationName: '馬祖', forecastLoc: '連江縣', countyName: '連江縣', townName: '南竿鄉', lat: 26.15, lng: 119.93 },
]

/** Mutable station registry — starts with defaults, enriched from CWA API on boot */
let CWA_STATIONS: StationInfo[] = [...DEFAULT_STATIONS]

/** Name → station lookup (supports aliases) */
let CWA_LOCATIONS: Record<string, StationInfo> = {}
function rebuildLocationIndex(): void {
  CWA_LOCATIONS = {}
  for (const s of CWA_STATIONS) {
    // Index by forecastLoc (county), stationName, and stationId
    if (!CWA_LOCATIONS[s.forecastLoc]) CWA_LOCATIONS[s.forecastLoc] = s
    CWA_LOCATIONS[s.stationName] = s
    CWA_LOCATIONS[s.stationId] = s
    // 台→臺 alias
    const alias = s.forecastLoc.replace('臺', '台')
    if (alias !== s.forecastLoc && !CWA_LOCATIONS[alias]) CWA_LOCATIONS[alias] = s
  }
  CWA_LOCATIONS['新竹市'] = CWA_LOCATIONS['新竹縣'] ?? CWA_LOCATIONS['新竹']
}
rebuildLocationIndex()

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Find the nearest station to a GPS coordinate */
function findNearestStation(lat: number, lng: number): StationInfo & { distanceKm: number } {
  let best = CWA_STATIONS[0]
  let bestDist = Infinity
  for (const s of CWA_STATIONS) {
    const d = haversineKm(lat, lng, s.lat, s.lng)
    if (d < bestDist) { best = s; bestDist = d }
  }
  return { ...best, distanceKm: Math.round(bestDist * 10) / 10 }
}

/* ------------------------------------------------------------------ */
/*  Error fallback (shown when API call fails)                         */
/* ------------------------------------------------------------------ */

/** Convert CWA wind direction text (e.g. "偏北風") to degrees */
function windTextToDeg(text: string): number {
  if (!text || typeof text !== 'string') return 0
  if (text.includes('北北東')) return 22.5
  if (text.includes('東北')) return 45
  if (text.includes('東南東')) return 112.5
  if (text.includes('東南')) return 135
  if (text.includes('南南東')) return 157.5
  if (text.includes('南南西')) return 202.5
  if (text.includes('西南')) return 225
  if (text.includes('西北西')) return 292.5
  if (text.includes('西北')) return 315
  if (text.includes('北北西')) return 337.5
  if (text.includes('北')) return 0
  if (text.includes('東')) return 90
  if (text.includes('南')) return 180
  if (text.includes('西')) return 270
  return 0
}

/** Calculate Vapor Pressure Deficit (kPa) from temp (°C) and RH (%) */
function calcVPD(tempC: number, rh: number): number {
  if (rh <= 0 || tempC < -40) return 0
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
  return Math.max(0, svp * (1 - rh / 100))
}

function errorCurrent(loc: string, reason: string): CurrentWeather {
  return {
    temp: 0, feelsLike: 0, humidity: 0, windSpeed: 0,
    windDirection: 0, pressure: 0, uvIndex: 0, sunshineDuration: 0,
    solarRadiation: 0, par: 0, solarSource: '', vpd: 0,
    description: reason, icon: '',
    location: loc,
    updatedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/*  Solar radiation helpers                                            */
/* ------------------------------------------------------------------ */

/** Estimate GHI (W/m²) from sunshine duration using Angström-Prescott */
function estimateGHI(sunshineDurationHrs: number, lat: number): number {
  if (sunshineDurationHrs <= 0) return 0
  // Rough extraterrestrial radiation for mid-latitudes (simplified)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * Math.PI / 180)
  const latRad = lat * Math.PI / 180
  const decRad = declination * Math.PI / 180
  const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad))
  const maxSunHrs = (24 / Math.PI) * hourAngle
  if (maxSunHrs <= 0) return 0
  const ratio = sunshineDurationHrs / maxSunHrs
  // Angström coefficients (a=0.25, b=0.50)
  const Gsc = 1361 // W/m² solar constant
  const Ra = (24 * 60 / Math.PI) * Gsc *
    (1 + 0.033 * Math.cos(2 * Math.PI * dayOfYear / 365)) *
    (hourAngle * Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.sin(hourAngle))
  const RaMJm2day = Ra * 0.0000036 // convert from J/m²/day to MJ/m²/day (÷1e6)
  const RsMJ = RaMJm2day * (0.25 + 0.50 * ratio)
  // Convert MJ/m²/day to average W/m² (÷86400×1e6)
  return Math.round(RsMJ * 1e6 / 86400)
}

/** Convert GHI (W/m²) to PAR (µmol/m²/s) — roughly 45% of solar, 4.57 factor */
function ghiToPAR(ghiWm2: number): number {
  return Math.round(ghiWm2 * 0.45 * 4.57)
}

/** Derived lat/lng lookups from unified station data */
const CWA_LATITUDES: Record<string, number> = Object.fromEntries(
  Object.entries(CWA_LOCATIONS).map(([k, v]) => [k, v.lat])
)
const CWA_LONGITUDES: Record<string, number> = Object.fromEntries(
  Object.entries(CWA_LOCATIONS).map(([k, v]) => [k, v.lng])
)

/** Fetch solar radiation from NASA POWER API (daily, recent) */
async function fetchNasaPower(lat: number, lng: number): Promise<{ ghi: number; par: number } | null> {
  try {
    // NASA POWER has ~5-7 day lag; try yesterday, then 3 days ago
    const tryDates: string[] = []
    for (const daysAgo of [1, 2, 3, 5, 7]) {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      tryDates.push(d.toISOString().slice(0, 10).replace(/-/g, ''))
    }
    const dateStr = tryDates[0]
    const endStr = tryDates[0]
    const startStr = tryDates[tryDates.length - 1]

    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?start=${startStr}&end=${endStr}&latitude=${lat}&longitude=${lng}&community=ag&parameters=ALLSKY_SFC_SW_DWN,ALLSKY_SFC_PAR_TOT&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json() as any
    const ghiData = json?.properties?.parameter?.ALLSKY_SFC_SW_DWN ?? {}
    const parData = json?.properties?.parameter?.ALLSKY_SFC_PAR_TOT ?? {}

    // Find the most recent valid value
    for (const dt of tryDates) {
      const ghiMJ = ghiData[dt]
      const parMJ = parData[dt]
      if (ghiMJ != null && ghiMJ > 0 && ghiMJ !== -999) {
        // Convert MJ/m²/day → average W/m² (÷86400×1e6)
        const ghiWm2 = Math.round(ghiMJ * 1e6 / 86400)
        // Convert PAR MJ/m²/day → µmol/m²/s (÷86400×1e6 × 4.57)
        const parVal = parMJ > 0 && parMJ !== -999
          ? Math.round(parMJ * 1e6 / 86400 * 4.57)
          : ghiToPAR(ghiWm2)
        return { ghi: ghiWm2, par: parVal }
      }
    }
    return null
  } catch (e) {
    console.warn('NASA POWER fetch failed:', e)
    return null
  }
}

function errorForecast(loc: string, reason: string): ForecastResponse {
  return { location: loc, days: [], points: [], updatedAt: new Date().toISOString() }
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 30 * 60 * 1000          // 30 min — for current obs & trend
const FORECAST_POLL_INTERVAL = 3 * 60 * 60 * 1000  // 3 hours — proactive forecast refresh
const CONFIG_PATH = join(process.cwd(), 'data', 'config', 'weather.json')

interface CacheEntry<T> { data: T; ts: number }

const DEFAULT_CONFIG: WeatherConfig = {
  provider: 'cwa',
  cwaApiKey: '',
  weatherApiKey: '',
  defaultLocation: '臺北市',
}

@Injectable()
export class WeatherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeatherService.name)
  private currentCache = new Map<string, CacheEntry<CurrentWeather>>()
  private forecastCache = new Map<string, CacheEntry<ForecastResponse>>()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  /** Fingerprint of last accepted forecast (first point time + point count) */
  private lastForecastFingerprint = new Map<string, string>()

  constructor(
    @Inject(forwardRef(() => EventsGateway))
    private readonly events: EventsGateway,
    private readonly database: DatabaseService,
  ) {}

  /** Prepared statement for bulk-inserting forecast points */
  private get insertForecastStmt() {
    return this.database.db.prepare(`
      INSERT INTO weather_forecast (fetched_at, location, time, temp, feels_like, humidity, wind_speed, wind_dir, rain_chance, dew_point, vpd)
      VALUES (@fetchedAt, @location, @time, @temp, @feelsLike, @humidity, @windSpeed, @windDir, @rainChance, @dewPoint, @vpd)
    `)
  }

  /** Insert observation only if the same (location, time) doesn't already exist */
  private get insertObservationStmt() {
    return this.database.db.prepare(`
      INSERT INTO weather_observation (fetched_at, location, time, temp, humidity, wind_speed, wind_dir, pressure, uv_index, vpd)
      SELECT @fetchedAt, @location, @time, @temp, @humidity, @windSpeed, @windDir, @pressure, @uvIndex, @vpd
      WHERE NOT EXISTS (
        SELECT 1 FROM weather_observation WHERE location = @location AND time = @time
      )
    `)
  }

  /** Query past observations from SQLite (last N hours) */
  private getObservationHistory(loc: string, hours = 72): HourlyPoint[] {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      const rows = this.database.db.prepare(`
        SELECT time, temp, humidity, wind_speed, wind_dir, vpd
        FROM weather_observation
        WHERE location = ? AND time >= ?
        ORDER BY time ASC
      `).all(loc, since) as any[]
      return rows.map(r => ({
        time: r.time,
        temp: r.temp ?? 0,
        humidity: r.humidity ?? 0,
        windSpeed: r.wind_speed ?? 0,
        windDirection: r.wind_dir ?? 0,
        vpd: r.vpd ?? 0,
      }))
    } catch (e) {
      this.logger.warn(`Failed to read observation history: ${(e as Error).message}`)
      return []
    }
  }

  /* ---------- Lifecycle: scheduled polling ---------- */

  private obsTimer: ReturnType<typeof setInterval> | null = null

  onModuleInit() {
    // Load full station list from CWA + start polling
    setTimeout(async () => {
      await this.loadStationsFromCwa()
      this.pollForecast()
      this.pollObservation()
    }, 5_000)
    // Forecast: every 3 hours
    this.pollTimer = setInterval(() => this.pollForecast(), FORECAST_POLL_INTERVAL)
    // Observations: every 30 minutes — accumulate history in SQLite
    this.obsTimer = setInterval(() => this.pollObservation(), CACHE_TTL)
    this.logger.log(`Polling enabled — forecast every ${FORECAST_POLL_INTERVAL / 3600000}h, observations every ${CACHE_TTL / 60000}min`)
  }

  /** Fetch full station list from CWA O-A0003-001 to build GPS lookup */
  private async loadStationsFromCwa(): Promise<void> {
    const config = this.getConfig()
    if (!config.cwaApiKey) return
    try {
      const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001?Authorization=${config.cwaApiKey}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as any
      const stations = json?.records?.Station ?? []
      const loaded: StationInfo[] = []
      for (const s of stations) {
        const wgs = s.GeoInfo?.Coordinates?.find((c: any) => c.CoordinateName === 'WGS84')
        const lat = Number(wgs?.StationLatitude) || 0
        const lng = Number(wgs?.StationLongitude) || 0
        if (!lat || !lng) continue
        const countyName = s.GeoInfo?.CountyName ?? ''
        loaded.push({
          stationId: s.StationId ?? '',
          stationName: s.StationName ?? '',
          forecastLoc: countyName,
          countyName,
          townName: s.GeoInfo?.TownName ?? '',
          lat,
          lng,
        })
      }
      if (loaded.length > 0) {
        // Merge: keep defaults for forecast mapping, add all CWA stations
        const seen = new Set(loaded.map(s => s.stationId))
        for (const d of DEFAULT_STATIONS) {
          if (!seen.has(d.stationId)) loaded.push(d)
        }
        CWA_STATIONS = loaded
        rebuildLocationIndex()
        this.logger.log(`Loaded ${loaded.length} CWA stations (${stations.length} from API)`)
      }
    } catch (e) {
      this.logger.warn(`Failed to load CWA stations: ${(e as Error).message} — using ${DEFAULT_STATIONS.length} defaults`)
    }
  }

  onModuleDestroy() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    if (this.obsTimer) { clearInterval(this.obsTimer); this.obsTimer = null }
  }

  /** Proactively fetch forecast and compare with cached version */
  private async pollForecast(): Promise<void> {
    const config = this.getConfig()
    if (config.provider !== 'cwa' || !config.cwaApiKey) return
    const loc = config.defaultLocation
    const cacheKey = `${config.provider}:${loc}`

    try {
      const fresh = await this.cwaForecast(config.cwaApiKey, loc)

      // Build fingerprint: first point time + total count + last point time
      const fp = fresh.points.length > 0
        ? `${fresh.points[0].time}|${fresh.points.length}|${fresh.points[fresh.points.length - 1].time}`
        : 'empty'

      const prev = this.lastForecastFingerprint.get(cacheKey)
      if (fp === prev) {
        this.logger.log(`Forecast poll [${loc}]: no change (${fp})`)
        return
      }

      // Data changed — update cache
      this.forecastCache.set(cacheKey, { data: fresh, ts: Date.now() })
      this.lastForecastFingerprint.set(cacheKey, fp)
      this.logger.log(`Forecast poll [${loc}]: updated — ${fresh.points.length} points, first=${fresh.points[0]?.time}`)

      // Also refresh trend forecast portion
      const trendKey = `trend:${config.provider}:${loc}`
      this.forecastCache.delete(trendKey)  // invalidate so next request fetches fresh

      // Push update to all connected clients
      this.events.emitWeatherForecastUpdated()

      // Append to history (JSONL — one JSON line per poll)
      this.appendForecastHistory(loc, fresh)
    } catch (e) {
      this.logger.warn(`Forecast poll [${loc}] failed: ${(e as Error).message}`)
    }
  }

  /** Proactively fetch current observation and save to SQLite */
  private async pollObservation(): Promise<void> {
    const config = this.getConfig()
    if (config.provider !== 'cwa' || !config.cwaApiKey) return
    const loc = config.defaultLocation

    try {
      const data = await this.cwaCurrent(config.cwaApiKey, loc)
      this.saveCurrentObservation(loc, data)
      this.logger.log(`Observation poll [${loc}]: ${data.temp}°C, ${data.humidity}% @ ${data.updatedAt}`)
    } catch (e) {
      this.logger.warn(`Observation poll [${loc}] failed: ${(e as Error).message}`)
    }
  }

  /** Save forecast points to SQLite (bulk insert in a transaction) */
  private appendForecastHistory(loc: string, data: ForecastResponse): void {
    try {
      const fetchedAt = new Date().toISOString()
      const stmt = this.insertForecastStmt
      const insertMany = this.database.db.transaction((points: ForecastPoint[]) => {
        for (const p of points) {
          stmt.run({
            fetchedAt,
            location: loc,
            time: p.time,
            temp: p.temp,
            feelsLike: p.feelsLike,
            humidity: p.humidity,
            windSpeed: p.windSpeed,
            windDir: p.windDirection,
            rainChance: p.rainChance,
            dewPoint: p.dewPoint,
            vpd: p.vpd,
          })
        }
      })
      insertMany(data.points)
      this.logger.log(`Forecast saved to SQLite: ${data.points.length} points for ${loc}`)
    } catch (e) {
      this.logger.warn(`Failed to save forecast to DB: ${(e as Error).message}`)
    }
  }

  /** Save a current-observation snapshot to SQLite (dedup by location+time) */
  private saveCurrentObservation(loc: string, data: CurrentWeather): void {
    try {
      this.insertObservationStmt.run({
        fetchedAt: new Date().toISOString(),
        location: loc,
        time: data.updatedAt,
        temp: data.temp,
        humidity: data.humidity,
        windSpeed: data.windSpeed,
        windDir: data.windDirection,
        pressure: data.pressure,
        uvIndex: data.uvIndex,
        vpd: data.vpd,
      })
    } catch (e) {
      this.logger.warn(`Failed to save observation: ${(e as Error).message}`)
    }
  }

  /** Save hourly trend observations to SQLite (dedup by location+time) */
  private saveObservationTrend(loc: string, points: HourlyPoint[]): void {
    if (points.length === 0) return
    try {
      const fetchedAt = new Date().toISOString()
      const stmt = this.insertObservationStmt
      const insertMany = this.database.db.transaction((pts: HourlyPoint[]) => {
        for (const p of pts) {
          stmt.run({
            fetchedAt,
            location: loc,
            time: p.time,
            temp: p.temp,
            humidity: p.humidity,
            windSpeed: p.windSpeed,
            windDir: p.windDirection,
            pressure: 0,
            uvIndex: 0,
            vpd: p.vpd,
          })
        }
      })
      insertMany(points)
    } catch (e) {
      this.logger.warn(`Failed to save trend observations: ${(e as Error).message}`)
    }
  }

  /* ---------- Config persistence ---------- */

  getConfig(): WeatherConfig {
    try {
      let config = { ...DEFAULT_CONFIG }
      if (existsSync(CONFIG_PATH)) {
        const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
        if (raw.provider === 'mock') raw.provider = 'cwa'
        config = { ...config, ...raw }
      }
      // .env takes precedence for API keys (secrets should live in env, not config files)
      if (process.env.CWA_API_KEY) config.cwaApiKey = process.env.CWA_API_KEY
      if (process.env.WEATHERAPI_KEY) config.weatherApiKey = process.env.WEATHERAPI_KEY
      // Resolve default location from GPS if set in .env
      if (process.env.DEFAULT_STATION_LAT && process.env.DEFAULT_STATION_LNG) {
        const nearest = findNearestStation(
          Number(process.env.DEFAULT_STATION_LAT),
          Number(process.env.DEFAULT_STATION_LNG),
        )
        config.defaultLocation = nearest.forecastLoc
        config.defaultStationId = nearest.stationId
      }
      return config
    } catch (e) {
      console.warn('Failed to read weather config:', e)
    }
    return { ...DEFAULT_CONFIG }
  }

  saveConfig(patch: Partial<WeatherConfig>): WeatherConfig {
    const config = { ...this.getConfig(), ...patch }
    const dir = join(process.cwd(), 'data', 'config')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    // Clear cache when config changes
    this.currentCache.clear()
    this.forecastCache.clear()
    return config
  }

  /* ---------- Public API ---------- */

  /** Find the nearest CWA station to a GPS coordinate */
  findNearest(lat: number, lng: number) {
    const s = findNearestStation(lat, lng)
    return {
      location: s.forecastLoc,
      stationId: s.stationId,
      stationName: s.stationName,
      countyName: s.countyName,
      townName: s.townName,
      distanceKm: s.distanceKm,
      lat: s.lat,
      lng: s.lng,
    }
  }

  /** List all available CWA stations */
  listStations() {
    return CWA_STATIONS.map(s => ({
      stationId: s.stationId,
      stationName: s.stationName,
      forecastLoc: s.forecastLoc,
      countyName: s.countyName,
      townName: s.townName,
      lat: s.lat,
      lng: s.lng,
    }))
  }

  async getCurrent(location?: string, stationId?: string): Promise<CurrentWeather> {
    const config = this.getConfig()
    const loc = location || config.defaultLocation
    const cacheKey = `${config.provider}:${stationId || loc}`

    const cached = this.currentCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    let data: CurrentWeather
    if (config.provider === 'cwa') {
      if (!config.cwaApiKey) return errorCurrent(loc, 'CWA API key not configured — open Settings')
      data = await this.cwaCurrent(config.cwaApiKey, loc, stationId)
    } else {
      if (!config.weatherApiKey) return errorCurrent(loc, 'weatherapi.com key not configured — open Settings')
      data = await this.weapiCurrent(config.weatherApiKey, loc)
    }

    // Enrich with solar radiation from NASA POWER (non-blocking)
    await this.enrichSolar(data, loc)

    this.currentCache.set(cacheKey, { data, ts: Date.now() })

    // Persist to SQLite (non-blocking, dedup by location+time)
    this.saveCurrentObservation(loc, data)

    return data
  }

  /** Enrich CurrentWeather with solar radiation data */
  private async enrichSolar(data: CurrentWeather, loc: string): Promise<void> {
    const lat = CWA_LATITUDES[loc] ?? 25.03
    const lng = CWA_LONGITUDES[loc] ?? 121.57

    // Try NASA POWER first
    const nasa = await fetchNasaPower(lat, lng)
    if (nasa) {
      data.solarRadiation = nasa.ghi
      data.par = nasa.par
      data.solarSource = 'nasa'
      return
    }

    // Fallback: estimate from sunshine duration
    if (data.sunshineDuration > 0) {
      const ghi = estimateGHI(data.sunshineDuration, lat)
      data.solarRadiation = ghi
      data.par = ghiToPAR(ghi)
      data.solarSource = 'estimated'
    }
  }

  async getForecast(location?: string): Promise<ForecastResponse> {
    const config = this.getConfig()
    const loc = location || config.defaultLocation
    const cacheKey = `${config.provider}:${loc}`

    const cached = this.forecastCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    let data: ForecastResponse
    if (config.provider === 'cwa') {
      if (!config.cwaApiKey) return errorForecast(loc, 'CWA API key not configured')
      data = await this.cwaForecast(config.cwaApiKey, loc)
    } else {
      if (!config.weatherApiKey) return errorForecast(loc, 'weatherapi.com key not configured')
      data = await this.weapiForecast(config.weatherApiKey, loc)
    }

    this.forecastCache.set(cacheKey, { data, ts: Date.now() })
    return data
  }

  async getTrend(location?: string, stationId?: string): Promise<TrendResponse> {
    const config = this.getConfig()
    const loc = location || config.defaultLocation
    const cacheKey = `trend:${config.provider}:${stationId || loc}`

    const cached = this.forecastCache.get(cacheKey) as CacheEntry<TrendResponse> | undefined
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as unknown as TrendResponse

    let data: TrendResponse
    if (config.provider === 'cwa') {
      if (!config.cwaApiKey) return { location: loc, past: [], future: [], updatedAt: new Date().toISOString() }
      data = await this.cwaTrend(config.cwaApiKey, loc, stationId)
    } else {
      if (!config.weatherApiKey) return { location: loc, past: [], future: [], updatedAt: new Date().toISOString() }
      data = await this.weapiTrend(config.weatherApiKey, loc)
    }

    // Store in a separate cache slot (reusing forecastCache map for simplicity)
    this.forecastCache.set(cacheKey, { data: data as any, ts: Date.now() })

    // Persist past observations to SQLite (dedup by location+time)
    this.saveObservationTrend(loc, data.past)

    return data
  }

  /* ================================================================ */
  /*  CWA (中央氣象署) API                                             */
  /* ================================================================ */

  private async cwaCurrent(apiKey: string, loc: string, overrideStationId?: string): Promise<CurrentWeather> {
    try {
      const station = overrideStationId || CWA_LOCATIONS[loc]?.stationId
      // O-A0003-001 = 現在天氣觀測 (自動氣象站)
      const url = station
        ? `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001?Authorization=${apiKey}&StationId=${station}`
        : `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0003-001?Authorization=${apiKey}&StationName=${encodeURIComponent(loc)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`CWA API ${res.status}`)
      const json = await res.json() as any
      const records = json?.records?.Station ?? json?.records?.location ?? []
      const s = records[0]
      if (!s) throw new Error('No station data')

      const obs = s.WeatherElement ?? {}
      const temp = obs.AirTemperature ?? obs.Temperature ?? -99
      const humd = obs.RelativeHumidity ?? -1
      const wind = obs.WindSpeed ?? 0
      const wx = obs.Weather ?? ''
      const windDir = obs.WindDirection ?? 0
      const pressure = obs.AirPressure ?? 0
      const uvi = obs.UVIndex ?? 0
      const sunshine = obs.SunshineDuration ?? 0

      const tempVal = typeof temp === 'object' ? temp.AirTemperature ?? 0 : Number(temp)
      const humVal = typeof humd === 'object' ? humd.RelativeHumidity ?? 0 : Number(humd)

      return {
        temp: tempVal,
        feelsLike: tempVal,
        humidity: humVal,
        windSpeed: typeof wind === 'object' ? wind.WindSpeed ?? 0 : Number(wind),
        windDirection: Number(windDir) || 0,
        pressure: Number(pressure) || 0,
        uvIndex: Number(uvi) || 0,
        sunshineDuration: Number(sunshine) || 0,
        solarRadiation: 0, par: 0, solarSource: '',
        vpd: Math.round(calcVPD(tempVal, humVal) * 100) / 100,
        description: typeof wx === 'string' ? wx : (wx?.Weather ?? ''),
        icon: typeof wx === 'string' ? wx : (wx?.Weather ?? ''),
        location: s.StationName ?? s.locationName ?? loc,
        updatedAt: new Date().toISOString(),
      }
    } catch (e) {
      console.warn('CWA current fetch failed:', e)
      return errorCurrent(loc, `CWA API error: ${(e as Error).message}`)
    }
  }

  private async cwaForecast(apiKey: string, loc: string): Promise<ForecastResponse> {
    try {
      const forecastLoc = CWA_LOCATIONS[loc]?.forecastLoc ?? loc
      // F-D0047-089 = 逐3小時天氣預報 (72小時)
      const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-089?Authorization=${apiKey}&locationName=${encodeURIComponent(forecastLoc)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`CWA forecast API ${res.status}`)
      const json = await res.json() as any

      // CWA uses PascalCase keys and Chinese element names
      const locs = json?.records?.Locations?.[0]?.Location ?? json?.records?.locations?.[0]?.location ?? []
      const target = locs.find((l: any) => l.LocationName === forecastLoc || l.locationName === forecastLoc) ?? locs[0]
      if (!target) throw new Error('No forecast data')

      const elements = target.WeatherElement ?? target.weatherElement ?? []
      const findEl = (name: string) => elements.find((e: any) => (e.ElementName ?? e.elementName) === name)
      const tEl = findEl('溫度')
      const flEl = findEl('體感溫度')
      const rhEl = findEl('相對濕度')
      const wsEl = findEl('風速')
      const wdEl = findEl('風向')
      const popEl = findEl('3小時降雨機率')
      const wxEl = findEl('天氣現象')
      const dpEl = findEl('露點溫度')

      // Helper to get first value from ElementValue array
      const getVal = (ev: any) => {
        if (!ev) return undefined
        const arr = ev.ElementValue ?? ev.elementValue
        if (!arr?.[0]) return undefined
        const obj = arr[0]
        return obj.Temperature ?? obj.ApparentTemperature ?? obj.DewPoint
          ?? obj.RelativeHumidity ?? obj.WindSpeed ?? obj.WindDirection
          ?? obj.ProbabilityOfPrecipitation ?? obj.Weather
          ?? obj.value ?? Object.values(obj)[0]
      }

      const elTimes = (el: any) => el?.Time ?? el?.time ?? []
      const getTime = (t: any) => t?.DataTime ?? t?.dataTime ?? t?.StartTime ?? t?.startTime ?? ''

      // Build 3-hour resolution forecast points
      const points: ForecastPoint[] = []
      const tTimes = elTimes(tEl)
      for (let i = 0; i < tTimes.length; i++) {
        const time = getTime(tTimes[i])
        if (!time) continue
        const temp = Number(getVal(tTimes[i])) || 0
        const fl = Number(getVal(elTimes(flEl)[i])) || temp
        const hum = Number(getVal(elTimes(rhEl)[i])) || 0
        const ws = Number(getVal(elTimes(wsEl)[i])) || 0
        const wdRaw = String(getVal(elTimes(wdEl)[i]) ?? '')
        const wd = windTextToDeg(wdRaw)
        const pop = Number(getVal(elTimes(popEl)[i])) || 0
        const dp = Number(getVal(elTimes(dpEl)[i])) || 0
        points.push({
          time,
          temp,
          feelsLike: fl,
          humidity: hum,
          windSpeed: ws,
          windDirection: wd,
          rainChance: pop,
          dewPoint: dp,
          vpd: Math.round(calcVPD(temp, hum) * 100) / 100,
        })
      }

      // Aggregate per-day for the day summary cards
      const dayMap = new Map<string, { temps: number[]; wx: string; pop: number }>()
      const wxTimes = elTimes(wxEl)
      for (let i = 0; i < tTimes.length; i++) {
        const dateStr = getTime(tTimes[i]).slice(0, 10)
        if (!dateStr) continue
        const temp = Number(getVal(tTimes[i])) || 0
        const pop = Number(getVal(elTimes(popEl)[i])) || 0
        const entry = dayMap.get(dateStr) ?? { temps: [], wx: '', pop: 0 }
        entry.temps.push(temp)
        entry.pop = Math.max(entry.pop, pop)
        if (!entry.wx) {
          const wxVal = getVal(wxTimes[i])
          if (wxVal) entry.wx = String(wxVal)
        }
        dayMap.set(dateStr, entry)
      }

      const days: DayForecast[] = []
      for (const [date, d] of dayMap) {
        days.push({
          date,
          tempHigh: Math.max(...d.temps),
          tempLow: Math.min(...d.temps),
          description: d.wx || '',
          icon: d.wx || '',
          rainChance: d.pop,
        })
        if (days.length >= 4) break
      }

      return {
        location: target.LocationName ?? target.locationName ?? forecastLoc,
        days,
        points,
        updatedAt: new Date().toISOString(),
      }
    } catch (e) {
      console.warn('CWA forecast fetch failed:', e)
      return errorForecast(loc, `CWA forecast error: ${(e as Error).message}`)
    }
  }

  /* ================================================================ */
  /*  weatherapi.com                                                   */
  /* ================================================================ */

  private async weapiCurrent(apiKey: string, loc: string): Promise<CurrentWeather> {
    try {
      const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(loc)}&aqi=no`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Weather API ${res.status}`)
      const json = await res.json() as any
      const c = json.current
      const tempC = c.temp_c
      const rh = c.humidity
      return {
        temp: tempC,
        feelsLike: c.feelslike_c,
        humidity: rh,
        windSpeed: c.wind_kph / 3.6,
        windDirection: c.wind_degree ?? 0,
        pressure: c.pressure_mb ?? 0,
        uvIndex: c.uv ?? 0,
        sunshineDuration: 0,
        solarRadiation: 0, par: 0, solarSource: '',
        vpd: Math.round(calcVPD(tempC, rh) * 100) / 100,
        description: c.condition?.text ?? '',
        icon: c.condition?.icon ?? '',
        location: json.location?.name ?? loc,
        updatedAt: new Date().toISOString(),
      }
    } catch (e) {
      console.warn('weatherapi.com fetch failed:', e)
      return errorCurrent(loc, `weatherapi.com error: ${(e as Error).message}`)
    }
  }

  private async weapiForecast(apiKey: string, loc: string): Promise<ForecastResponse> {
    try {
      const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(loc)}&days=5&aqi=no`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Weather API ${res.status}`)
      const json = await res.json() as any
      const forecastDays = json.forecast?.forecastday ?? []
      const days: DayForecast[] = forecastDays.map((d: any) => ({
        date: d.date,
        tempHigh: d.day.maxtemp_c,
        tempLow: d.day.mintemp_c,
        description: d.day.condition?.text ?? '',
        icon: d.day.condition?.icon ?? '',
        rainChance: d.day.daily_chance_of_rain ?? 0,
      }))
      // Build hourly forecast points
      const points: ForecastPoint[] = []
      for (const d of forecastDays) {
        for (const h of d?.hour ?? []) {
          points.push({
            time: h.time,
            temp: h.temp_c,
            feelsLike: h.feelslike_c ?? h.temp_c,
            humidity: h.humidity,
            windSpeed: h.wind_kph / 3.6,
            windDirection: h.wind_degree ?? 0,
            rainChance: h.chance_of_rain ?? 0,
            dewPoint: h.dewpoint_c ?? 0,
            vpd: Math.round(calcVPD(h.temp_c, h.humidity) * 100) / 100,
          })
        }
      }
      return {
        location: json.location?.name ?? loc,
        days,
        points,
        updatedAt: new Date().toISOString(),
      }
    } catch (e) {
      console.warn('weatherapi.com forecast failed:', e)
      return errorForecast(loc, `weatherapi.com error: ${(e as Error).message}`)
    }
  }

  /* ================================================================ */
  /*  Trend data (hourly past + future)                                */
  /* ================================================================ */

  private async cwaTrend(apiKey: string, loc: string, overrideStationId?: string): Promise<TrendResponse> {
    const empty: TrendResponse = { location: loc, past: [], future: [], updatedAt: new Date().toISOString() }
    try {
      const station = overrideStationId || CWA_LOCATIONS[loc]?.stationId
      if (!station) return empty

      // 1) Read accumulated history from SQLite (past 72h)
      const dbPast = this.getObservationHistory(loc, 72)

      // 2) Fetch latest live observation from CWA and merge
      try {
        const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001?Authorization=${apiKey}&StationId=${station}`
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json() as any
          const stations = json?.records?.Station ?? []
          for (const s of stations) {
            const obs = s.WeatherElement ?? {}
            const time = s.ObsTime?.DateTime ?? ''
            if (!time) continue
            const t = Number(typeof obs.AirTemperature === 'object' ? obs.AirTemperature?.AirTemperature : obs.AirTemperature) || 0
            const rh = Number(typeof obs.RelativeHumidity === 'object' ? obs.RelativeHumidity?.RelativeHumidity : obs.RelativeHumidity) || 0
            const point: HourlyPoint = {
              time,
              temp: t,
              humidity: rh,
              windSpeed: Number(typeof obs.WindSpeed === 'object' ? obs.WindSpeed?.WindSpeed : obs.WindSpeed) || 0,
              windDirection: Number(obs.WindDirection) || 0,
              vpd: Math.round(calcVPD(t, rh) * 100) / 100,
            }
            // Save to DB immediately (dedup)
            this.saveCurrentObservation(loc, {
              temp: t, feelsLike: t, humidity: rh,
              windSpeed: point.windSpeed, windDirection: point.windDirection,
              pressure: Number(obs.AirPressure) || 0, uvIndex: 0,
              sunshineDuration: 0, solarRadiation: 0, par: 0, solarSource: '',
              vpd: point.vpd, description: '', icon: '', location: loc, updatedAt: time,
            })
            dbPast.push(point)
          }
        }
      } catch { /* live fetch optional — DB history is the main source */ }

      // 3) Dedup by time and sort
      const seen = new Set<string>()
      const past: HourlyPoint[] = []
      for (const p of dbPast) {
        const key = p.time.slice(0, 16) // dedup to minute precision
        if (seen.has(key)) continue
        seen.add(key)
        past.push(p)
      }
      past.sort((a, b) => a.time.localeCompare(b.time))

      // Future: extract from 3-hour forecast (F-D0047-089)
      const future: HourlyPoint[] = []
      try {
        const forecastLoc = CWA_LOCATIONS[loc]?.forecastLoc ?? loc
        const fUrl = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-089?Authorization=${apiKey}&locationName=${encodeURIComponent(forecastLoc)}`
        const fRes = await fetch(fUrl)
        if (fRes.ok) {
          const fJson = await fRes.json() as any
          const fLocs = fJson?.records?.Locations?.[0]?.Location ?? fJson?.records?.locations?.[0]?.location ?? []
          const target = fLocs.find((l: any) => (l.LocationName ?? l.locationName) === forecastLoc) ?? fLocs[0]
          if (target) {
            const elements = target.WeatherElement ?? target.weatherElement ?? []
            const findEl = (name: string) => elements.find((e: any) => (e.ElementName ?? e.elementName) === name)
            const tEl = findEl('溫度')
            const rhEl = findEl('相對濕度')
            const wsEl = findEl('風速')
            const wdEl = findEl('風向')
            const getFirstVal = (ev: any) => {
              const arr = ev?.ElementValue ?? ev?.elementValue
              if (!arr?.[0]) return undefined
              const obj = arr[0]
              return obj.Temperature ?? obj.RelativeHumidity ?? obj.WindSpeed ?? obj.WindDirection ?? obj.value ?? Object.values(obj)[0]
            }
            const getTime = (t: any) => t?.DataTime ?? t?.dataTime ?? t?.StartTime ?? t?.startTime ?? ''
            const times = tEl?.Time ?? tEl?.time ?? []
            const rhTimes = rhEl?.Time ?? rhEl?.time ?? []
            const wsTimes = wsEl?.Time ?? wsEl?.time ?? []
            const wdTimes = wdEl?.Time ?? wdEl?.time ?? []
            for (let i = 0; i < times.length; i++) {
              const ft = Number(getFirstVal(times[i])) || 0
              const fRh = Number(getFirstVal(rhTimes[i])) || 0
              const fWs = Number(getFirstVal(wsTimes[i])) || 0
              const fWdRaw = String(getFirstVal(wdTimes[i]) ?? '')
              const fWd = windTextToDeg(fWdRaw)
              future.push({
                time: getTime(times[i]),
                temp: ft,
                humidity: fRh,
                windSpeed: fWs,
                windDirection: fWd,
                vpd: Math.round(calcVPD(ft, fRh) * 100) / 100,
              })
            }
          }
        }
      } catch { /* forecast trend is optional */ }

      return { location: loc, past, future, updatedAt: new Date().toISOString() }
    } catch (e) {
      console.warn('CWA trend fetch failed:', e)
      return empty
    }
  }

  private async weapiTrend(apiKey: string, loc: string): Promise<TrendResponse> {
    const empty: TrendResponse = { location: loc, past: [], future: [], updatedAt: new Date().toISOString() }
    try {
      // weatherapi.com history (yesterday) + forecast (today+tomorrow with hourly)
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const yd = yesterday.toISOString().slice(0, 10)

      const [histRes, foreRes] = await Promise.all([
        fetch(`https://api.weatherapi.com/v1/history.json?key=${apiKey}&q=${encodeURIComponent(loc)}&dt=${yd}`),
        fetch(`https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(loc)}&days=2&aqi=no`),
      ])

      const past: HourlyPoint[] = []
      if (histRes.ok) {
        const hJson = await histRes.json() as any
        for (const day of hJson?.forecast?.forecastday ?? []) {
          for (const h of day?.hour ?? []) {
            past.push({
              time: h.time,
              temp: h.temp_c,
              humidity: h.humidity,
              windSpeed: h.wind_kph / 3.6,
              windDirection: h.wind_degree ?? 0,
              vpd: Math.round(calcVPD(h.temp_c, h.humidity) * 100) / 100,
            })
          }
        }
      }

      const future: HourlyPoint[] = []
      if (foreRes.ok) {
        const fJson = await foreRes.json() as any
        for (const day of fJson?.forecast?.forecastday ?? []) {
          for (const h of day?.hour ?? []) {
            future.push({
              time: h.time,
              temp: h.temp_c,
              humidity: h.humidity,
              windSpeed: h.wind_kph / 3.6,
              windDirection: h.wind_degree ?? 0,
              vpd: Math.round(calcVPD(h.temp_c, h.humidity) * 100) / 100,
            })
          }
        }
      }

      return {
        location: loc,
        past,
        future,
        updatedAt: new Date().toISOString(),
      }
    } catch (e) {
      console.warn('weatherapi.com trend failed:', e)
      return empty
    }
  }
}
