import { Injectable } from '@nestjs/common'

/* ------------------------------------------------------------------ */
/*  Domain interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface CurrentWeather {
  temp: number          // Celsius
  feelsLike: number
  humidity: number      // %
  windSpeed: number     // m/s
  description: string
  icon: string          // weather icon code or emoji
  updatedAt: string     // ISO timestamp
}

export interface DayForecast {
  date: string          // YYYY-MM-DD
  tempHigh: number
  tempLow: number
  description: string
  icon: string
  rainChance: number    // 0-100 %
}

export interface ForecastResponse {
  days: DayForecast[]
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/*  Mock data (used when no API key is configured)                     */
/* ------------------------------------------------------------------ */

function mockCurrent(): CurrentWeather {
  return {
    temp: 26,
    feelsLike: 28,
    humidity: 65,
    windSpeed: 3.2,
    description: 'Partly Cloudy',
    icon: 'partly_cloudy',
    updatedAt: new Date().toISOString(),
  }
}

function mockForecast(): ForecastResponse {
  const today = new Date()
  const days: DayForecast[] = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return {
      date: d.toISOString().slice(0, 10),
      tempHigh: 28 + Math.round(Math.random() * 4 - 2),
      tempLow: 20 + Math.round(Math.random() * 4 - 2),
      description: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Clear'][i % 5],
      icon: ['sunny', 'partly_cloudy', 'cloudy', 'rain', 'clear'][i % 5],
      rainChance: Math.round(Math.random() * 60),
    }
  })
  return { days, updatedAt: new Date().toISOString() }
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

@Injectable()
export class WeatherService {
  private currentCache: { data: CurrentWeather; ts: number } | null = null
  private forecastCache: { data: ForecastResponse; ts: number } | null = null

  private get apiKey(): string | undefined {
    return process.env.WEATHER_API_KEY
  }

  private get location(): string {
    return process.env.WEATHER_LOCATION ?? '25.0330,121.5654' // default: Taipei
  }

  async getCurrent(): Promise<CurrentWeather> {
    if (this.currentCache && Date.now() - this.currentCache.ts < CACHE_TTL) {
      return this.currentCache.data
    }

    let data: CurrentWeather
    if (this.apiKey) {
      data = await this.fetchCurrentFromApi()
    } else {
      data = mockCurrent()
    }

    this.currentCache = { data, ts: Date.now() }
    return data
  }

  async getForecast(): Promise<ForecastResponse> {
    if (this.forecastCache && Date.now() - this.forecastCache.ts < CACHE_TTL) {
      return this.forecastCache.data
    }

    let data: ForecastResponse
    if (this.apiKey) {
      data = await this.fetchForecastFromApi()
    } else {
      data = mockForecast()
    }

    this.forecastCache = { data, ts: Date.now() }
    return data
  }

  /* ---------- External API (weatherapi.com) ---------- */

  private async fetchCurrentFromApi(): Promise<CurrentWeather> {
    try {
      const url = `https://api.weatherapi.com/v1/current.json?key=${this.apiKey}&q=${this.location}&aqi=no`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Weather API ${res.status}`)
      const json = await res.json() as any
      const c = json.current
      return {
        temp: c.temp_c,
        feelsLike: c.feelslike_c,
        humidity: c.humidity,
        windSpeed: c.wind_kph / 3.6, // kph -> m/s
        description: c.condition?.text ?? '',
        icon: c.condition?.icon ?? '',
        updatedAt: new Date().toISOString(),
      }
    } catch (e) {
      console.warn('Weather API fetch failed, using mock:', e)
      return mockCurrent()
    }
  }

  private async fetchForecastFromApi(): Promise<ForecastResponse> {
    try {
      const url = `https://api.weatherapi.com/v1/forecast.json?key=${this.apiKey}&q=${this.location}&days=5&aqi=no`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Weather API ${res.status}`)
      const json = await res.json() as any
      const days: DayForecast[] = (json.forecast?.forecastday ?? []).map((d: any) => ({
        date: d.date,
        tempHigh: d.day.maxtemp_c,
        tempLow: d.day.mintemp_c,
        description: d.day.condition?.text ?? '',
        icon: d.day.condition?.icon ?? '',
        rainChance: d.day.daily_chance_of_rain ?? 0,
      }))
      return { days, updatedAt: new Date().toISOString() }
    } catch (e) {
      console.warn('Weather API forecast failed, using mock:', e)
      return mockForecast()
    }
  }
}
