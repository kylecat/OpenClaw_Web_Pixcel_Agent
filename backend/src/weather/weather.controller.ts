import { Controller, Get } from '@nestjs/common'
import { WeatherService } from './weather.service.js'
import type { CurrentWeather, ForecastResponse } from './weather.service.js'

@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get('current')
  getCurrent(): Promise<CurrentWeather> {
    return this.weather.getCurrent()
  }

  @Get('forecast')
  getForecast(): Promise<ForecastResponse> {
    return this.weather.getForecast()
  }
}
