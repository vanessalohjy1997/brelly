---
name: nea-weather-api
description: "Reference for Singapore NEA / data.gov.sg real-time weather APIs (2-hour nowcast, 24-hour forecast, 4-day outlook, PM2.5) — endpoints, exact response schemas, auth, rate limits, and known quirks. Use this whenever working on Brelly or any Singapore weather feature, including fetching forecasts, mapping forecast text to icons/risk scores, matching NEA 'area' names to Google Places results, handling API downtime, or debugging why a forecast field is missing or differently-shaped than expected. Also consult when integrating PM2.5/haze data alongside forecasts."
---

# NEA / data.gov.sg Weather APIs

Base URL for all real-time environment APIs: `https://api-open.data.gov.sg/v2/real-time/api/`

All endpoints are GET requests. No API key is strictly required for basic use (public data), but data.gov.sg supports an optional `x-api-key` header for higher rate limits — sign up at data.gov.sg if Brelly starts hitting limits (there is no published hard number; treat frequent 429s as the signal).

## Endpoints

| Forecast | Path | Update frequency |
|---|---|---|
| 2-hour nowcast | `/two-hr-forecast` | Every 30 min |
| 24-hour forecast | `/twenty-four-hr-forecast` | Several times/day |
| 4-day outlook | `/four-day-outlook` | Twice a day |
| PM2.5 | `/pm25` | Hourly |

Optional query param on all of them: `date` — `YYYY-MM-DD` (all readings for that day) or `YYYY-MM-DDTHH:mm:ss` (latest reading as of that moment). Omit `date` to get the current/latest reading. There's also a `paginationToken` param that appears in the response when a date-filtered query has more pages.

**Always call `web_fetch` or `curl` against the live endpoint before writing parsing code for a session** — response shapes below are accurate as of the last check but NEA/data.gov.sg has changed field casing (snake_case → camelCase) across API versions before, and this is exactly the kind of drift a skill can go stale on.

## Response envelope (all endpoints)

```json
{
  "code": 0,
  "errorMsg": "",
  "data": { /* endpoint-specific, see below */ }
}
```

`code: 0` means success. Non-zero means check `errorMsg`. A 400 means bad `date` format or bad pagination token; a 404 means no data for that date.

## 2-hour nowcast (`/two-hr-forecast`) — this is the one Brelly cares about most

```json
{
  "code": 0,
  "errorMsg": "",
  "data": {
    "area_metadata": [
      { "name": "Ang Mo Kio", "label_location": { "latitude": 1.375, "longitude": 103.839 } }
    ],
    "items": [
      {
        "timestamp": "2026-07-30T14:30:00+08:00",
        "update_timestamp": "2026-07-30T14:35:02+08:00",
        "valid_period": { "start": "2026-07-30T14:30:00+08:00", "end": "2026-07-30T16:30:00+08:00" },
        "forecasts": [
          { "area": "Ang Mo Kio", "forecast": "Cloudy" }
        ]
      }
    ]
  }
}
```

Notes:
- `area_metadata` covers **47 planning areas**, not every neighborhood. Brelly needs a nearest-area matcher (haversine distance from `label_location`) to map a Google Places lat/lng to the nearest NEA area — do not try to string-match area names to Places `formatted_address`, they don't line up.
- `forecast` text values are a fixed vocabulary (e.g. `"Fair"`, `"Fair (Day)"`, `"Cloudy"`, `"Partly Cloudy"`, `"Light Rain"`, `"Moderate Rain"`, `"Heavy Rain"`, `"Thundery Showers"`, `"Heavy Thundery Showers"`, `"Heavy Thundery Showers with Gusty Winds"`, `"Windy"`, `"Mist"`, `"Hazy"`). Build the icon/risk mapping off this closed set and fall back to a generic "unknown" icon for anything else, don't assume you've seen the full list.
- `items` is normally a single-element array for the "latest" case (no `date` param). When `date` is a full day, you get multiple `items`, one per half-hour issuance.

## 24-hour forecast (`/twenty-four-hr-forecast`)

Shape differs meaningfully from the 2-hour one — it has a `general` block (nationwide temp/humidity/wind range and a day narrative) plus `periods`, each with regional (north/south/east/west/central) forecasts rather than per-area:

```json
{
  "data": {
    "records": [
      {
        "general": {
          "forecast": "Afternoon thundery showers",
          "relative_humidity": { "low": 60, "high": 95 },
          "temperature": { "low": 25, "high": 33 },
          "wind": { "speed": { "low": 10, "high": 20 }, "direction": "SW" }
        },
        "periods": [
          {
            "timePeriod": { "start": "...", "end": "..." },
            "regions": { "west": "Thundery Showers", "east": "Cloudy", "central": "Cloudy", "south": "Fair", "north": "Cloudy" }
          }
        ]
      }
    ]
  }
}
```

Use this for a "later today" summary view, not for per-stop precision — it's regional, not area-level. For per-stop precision always prefer the 2-hour nowcast when the itinerary stop is within the next ~2 hours, and fall back to this for anything further out same-day.

## 4-day outlook (`/four-day-outlook`)

One entry per day, nationwide (no area/region breakdown):
```json
{ "data": { "records": [ { "forecasts": [ { "timestamp": "...", "forecast": "Thundery Showers", "relative_humidity": {...}, "temperature": {...}, "wind": {...} } ] } ] } }
```
Useful for multi-day itinerary planning views, not for same-day stop-level accuracy.

## PM2.5 (`/pm25`)

Region-level (national/east/west/north/south/central), µg/m³, hourly:
```json
{
  "data": {
    "regionMetadata": [ { "name": "east", "labelLocation": { "latitude": ..., "longitude": ... } } ],
    "items": [ { "date": "2026-07-30", "updatedTimestamp": "...", "timestamp": "...", "readings": { "pm25_one_hourly": { "national": 12, "east": 14, "west": 11, "north": 10, "south": 13, "central": 15 } } } ]
  }
}
```
Note the region set here (national/east/west/north/south/central) is coarser than the 47-area nowcast set — map a stop to one of 5 regions, not 47 areas, for haze/PM2.5 purposes. A reasonable bucketing: use the planning area's approximate compass position relative to central Singapore.

## Practical integration notes for Brelly

- **Caching**: nowcast changes every 30 min — don't poll more than every 5–10 min per unique area from a client; cache in MMKV keyed by area name + rounded-to-5-min timestamp, and treat a cached value under ~10 min old as fresh enough to reuse.
- **Nearest-area matching**: precompute `area_metadata` (or region metadata) once per session/cache it in MMKV — it doesn't change. Do the haversine nearest-neighbor lookup client-side rather than re-fetching metadata per stop.
- **Offline fallback**: if a fetch fails, prefer showing the last cached forecast with a visible "as of HH:MM" staleness indicator over showing nothing — NEA's endpoints do have occasional short outages.
- **No auth required** for reasonable use; don't build API-key management UI unless Brelly starts seeing 429s in practice.
- **Timestamps** are already SGT (`+08:00` offset) — don't apply additional timezone conversion.
