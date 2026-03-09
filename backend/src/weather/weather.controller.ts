import { Controller, Get, Put, Query, Body } from '@nestjs/common'
import { WeatherService } from './weather.service.js'
import type { CurrentWeather, ForecastResponse, TrendResponse, WeatherConfig } from './weather.service.js'

@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get('current')
  getCurrent(
    @Query('location') location?: string,
    @Query('stationId') stationId?: string,
  ): Promise<CurrentWeather> {
    return this.weather.getCurrent(location, stationId)
  }

  @Get('forecast')
  getForecast(@Query('location') location?: string): Promise<ForecastResponse> {
    return this.weather.getForecast(location)
  }

  @Get('trend')
  getTrend(
    @Query('location') location?: string,
    @Query('stationId') stationId?: string,
  ): Promise<TrendResponse> {
    return this.weather.getTrend(location, stationId)
  }

  /** Find nearest station to GPS coordinate: GET /weather/nearest?lat=25.03&lng=121.57 */
  @Get('nearest')
  findNearest(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.weather.findNearest(Number(lat), Number(lng))
  }

  /** List all available CWA stations: GET /weather/stations */
  @Get('stations')
  listStations() {
    return this.weather.listStations()
  }

  @Get('config')
  getConfig(): WeatherConfig {
    return this.weather.getConfig()
  }

  @Put('config')
  updateConfig(@Body() body: Partial<WeatherConfig>): WeatherConfig {
    return this.weather.saveConfig(body)
  }
}
