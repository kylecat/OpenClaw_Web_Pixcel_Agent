---
name: L2_farm-weather-station
level: 2
description: "[L2 - Integration] Use the PixelAgent Weather Station to read real-time observations, forecasts, trends, and manage station selection. Use when asked to check weather, compare stations, plan irrigation, or evaluate growing conditions."
---

# Farm Weather Station (PixelAgent)

## Overview

This skill teaches any agent how to use the **PixelAgent Weather Station** — a CWA (中央氣象署) integrated weather dashboard that provides real-time observations, 7-day forecasts, hourly trends, and solar radiation data. The weather station is a clickable building in the farm scene and a panel in the frontend UI.

---

## Environment

| Variable | Description | Example |
|----------|-------------|---------|
| `PIXELAGENT_API` | Backend API base URL | `http://localhost:3000` |
| `CWA_API_KEY` | CWA open-data API key (`.env`) | `CWA-XXXXXXXX-...` |
| `DEFAULT_STATION_LAT` | Default GPS latitude (`.env`) | `25.0174` |
| `DEFAULT_STATION_LNG` | Default GPS longitude (`.env`) | `121.5405` |

> The backend auto-resolves `DEFAULT_STATION_LAT/LNG` to the nearest CWA station on startup.

---

## Data Architecture

```
CWA API ──→ Backend (NestJS) ──→ SQLite (history) ──→ Frontend (React)
                │                                          │
                ├── O-A0003-001  (current observation)     ├── Overview tab
                ├── O-A0001-001  (hourly trend)            ├── Forecast tab
                ├── F-D0047-089  (7-day forecast)          ├── Trend tab
                └── NASA POWER   (solar radiation)         └── Settings tab
```

### Data Granularity

| Data Type | Resolution | Station-Level? | API |
|-----------|-----------|---------------|-----|
| Current observation | Real-time (30min cache) | Yes — per `stationId` | `O-A0003-001` |
| Hourly trend | Past 24h observed | Yes — per `stationId` | `O-A0001-001` |
| 7-day forecast | 3-hour periods | **No** — county-level only | `F-D0047-089` |
| Solar radiation | Daily average | GPS-based (lat/lng) | NASA POWER |

> Forecast data is always county-level (22 counties). Selecting a specific station only changes observation data (current + trend), not the forecast.

---

## API Reference

All endpoints are under `${PIXELAGENT_API}/weather/`.

### Current Observation

```bash
# Default location (from config)
curl ${PIXELAGENT_API}/weather/current

# Specific county
curl "${PIXELAGENT_API}/weather/current?location=臺北市"

# Specific station (overrides county default)
curl "${PIXELAGENT_API}/weather/current?location=臺北市&stationId=466910"
```

**Response** (`CurrentWeather`):

| Field | Type | Description |
|-------|------|-------------|
| `temp` | number | Temperature (°C) |
| `feelsLike` | number | Apparent temperature (°C) |
| `humidity` | number | Relative humidity (%) |
| `windSpeed` | number | Wind speed (m/s) |
| `windDirection` | number | Wind direction (degrees, 0=N) |
| `pressure` | number | Atmospheric pressure (hPa) |
| `uvIndex` | number | UV index |
| `sunshineDuration` | number | Sunshine duration (hours) |
| `solarRadiation` | number | GHI — Global Horizontal Irradiance (W/m²) |
| `par` | number | PAR — Photosynthetically Active Radiation (µmol/m²/s) |
| `solarSource` | string | `'nasa'`, `'estimated'`, or `''` |
| `vpd` | number | Vapor Pressure Deficit (kPa) |
| `description` | string | Weather description (e.g. "晴") |
| `location` | string | Location name |
| `updatedAt` | string | ISO timestamp |

### 7-Day Forecast

```bash
curl "${PIXELAGENT_API}/weather/forecast?location=臺北市"
```

**Response** (`ForecastResponse`):
- `days[]`: Array of `DayForecast` (date, tempHigh, tempLow, description, rainChance)
- `points[]`: Array of `ForecastPoint` (3-hour resolution with temp, humidity, wind, VPD, dewPoint)

### Hourly Trend

```bash
# Past 24h + future forecast merged
curl "${PIXELAGENT_API}/weather/trend?location=臺北市&stationId=466910"
```

**Response** (`TrendResponse`):
- `past[]`: Past 24h observed `HourlyPoint` (temp, humidity, windSpeed, windDirection, vpd)
- `future[]`: Forecast hourly points (if available)

### Station Discovery

```bash
# List all ~100 CWA stations
curl ${PIXELAGENT_API}/weather/stations

# Find nearest station to GPS
curl "${PIXELAGENT_API}/weather/nearest?lat=25.0174&lng=121.5405"
```

**Nearest response**:

| Field | Type | Description |
|-------|------|-------------|
| `stationId` | string | CWA station ID (e.g. `466910`) |
| `stationName` | string | Station name (e.g. `臺大`) |
| `forecastLoc` | string | County for forecast (e.g. `臺北市`) |
| `countyName` | string | County |
| `townName` | string | Township |
| `lat` / `lng` | number | Station GPS coordinates |
| `distanceKm` | number | Distance from query point (km) |

### Configuration

```bash
# Read config (includes resolved defaultStationId)
curl ${PIXELAGENT_API}/weather/config

# Update config
curl -X PUT ${PIXELAGENT_API}/weather/config \
  -H 'Content-Type: application/json' \
  -d '{"defaultLocation": "臺中市"}'
```

---

## Station Selection

### Hierarchy

The station system has two levels:

1. **County** (22 counties) — determines forecast data and default observation station
2. **Station** (~100 stations) — determines observation data (current + trend)

Multiple stations exist per county. Example for 臺北市:

| Station ID | Name | Township |
|-----------|------|----------|
| 466920 | 臺北 | 中正區 |
| 466910 | 臺大 | 大安區 |
| ... | 陽明山, 社子, ... | ... |

### Selection Priority

1. If `stationId` is provided → use that station for observations
2. If only `location` (county) → use the county's default station
3. If neither → use `defaultLocation` / `defaultStationId` from config

### Default Station Resolution

On startup, if `.env` has `DEFAULT_STATION_LAT` and `DEFAULT_STATION_LNG`:
- Backend finds the nearest CWA station via Haversine distance
- Sets `defaultLocation` (county) and `defaultStationId` (station)
- Frontend auto-selects this station in the cascading dropdown

---

## Workflow — Check Weather for a Location

### Step 1 — Determine Station

```bash
# Option A: Use GPS to find nearest
NEAREST=$(curl -s "${PIXELAGENT_API}/weather/nearest?lat=25.0174&lng=121.5405")
STATION_ID=$(echo $NEAREST | jq -r '.stationId')
LOCATION=$(echo $NEAREST | jq -r '.forecastLoc')

# Option B: Use known county
LOCATION="臺北市"
STATION_ID=""  # will use county default
```

### Step 2 — Fetch All Weather Data

```bash
QS="?location=${LOCATION}"
[ -n "$STATION_ID" ] && QS="${QS}&stationId=${STATION_ID}"

# Current observation
curl -s "${PIXELAGENT_API}/weather/current${QS}" | jq

# Forecast (county-level only, no stationId needed)
curl -s "${PIXELAGENT_API}/weather/forecast?location=${LOCATION}" | jq

# Trend (past 24h + future)
curl -s "${PIXELAGENT_API}/weather/trend${QS}" | jq
```

### Step 3 — Interpret for Agriculture

Key fields for farm decisions:

| Metric | Good Range (general crops) | Decision |
|--------|---------------------------|----------|
| VPD | 0.4–1.2 kPa | < 0.4 = too humid; > 1.6 = stress |
| PAR | 200–600 µmol/m²/s | Higher = more photosynthesis capacity |
| Humidity | 50–80% | < 40% = irrigation needed |
| Wind Speed | < 5 m/s | > 8 m/s = secure greenhouse vents |
| Rain Chance | — | > 60% = skip irrigation |
| Temperature | 18–30°C | < 10°C or > 35°C = crop stress |

---

## Caching & Polling

| Data | Cache TTL | Poll Interval | Storage |
|------|-----------|---------------|---------|
| Current observation | 30 min | 30 min | SQLite (`weather_observation`) |
| Forecast | 30 min | 3 hours | SQLite (`weather_forecast`) |
| Station list | On boot | Once | Memory |

- Cache keys include `stationId` when specified — different stations have separate caches
- Config changes (via `PUT /weather/config`) clear all caches
- Forecast updates push WebSocket events (`weather:forecast-updated`) to connected clients

---

## UI Interaction

### Via Farm Scene
1. Click the **Weather Station** building at grid `(8, 18)` in the farm scene
2. This opens the Weather Panel overlay

### Via Panel Tabs

| Tab | Content |
|-----|---------|
| **Overview** | Current conditions, solar data, station info (bottom-left) |
| **Forecast** | 7-day cards + 3-hour chart (county-level) |
| **Trend** | Past 24h + future line charts (temp, humidity, wind, VPD) |
| **Settings** | API provider, API keys, default location |

### Cascading Dropdown
- **First dropdown**: 22 counties (e.g. 臺北市, 臺中市, ...)
- **Second dropdown**: Stations within selected county (e.g. 臺北, 臺大, 陽明山, ...)
- Changing county resets station to "All stations" (county default)
- Selecting a specific station re-fetches observation data for that station

### GPS Locate Button
- Uses browser `navigator.geolocation`
- Sends GPS to `GET /weather/nearest` → auto-selects county + station

---

## Source Files

| File | Purpose |
|------|---------|
| `backend/src/weather/weather.service.ts` | CWA API integration, caching, polling, SQLite persistence |
| `backend/src/weather/weather.controller.ts` | REST endpoints |
| `backend/src/weather/weather.module.ts` | NestJS module |
| `frontend/src/components/WeatherPanel.tsx` | React panel UI (overview, forecast, trend, settings) |

---

## Rules

1. **Station-level only for observations**: Forecast is always county-level. Do not expect station-specific forecast data.
2. **Cache-aware**: Data may be up to 30 minutes old. Check `updatedAt` if freshness matters.
3. **API key required**: All CWA endpoints require `CWA_API_KEY` in `.env`. Without it, the service returns error messages.
4. **Solar data lag**: NASA POWER data has a 5–7 day lag. The system falls back to Angström-Prescott estimation from sunshine duration.
5. **Rate limits**: CWA API has rate limits. The polling system respects this with 30-min and 3-hour intervals. Avoid calling the same endpoint in rapid succession.
