import { degreesToCompass, wmoCodeToForecastText } from "@/utils/wmoWeatherCode";

import type { SlotForecast } from "./weather";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";
// Slots within this many days use the "openMeteoHourly" confidence tag
// rather than "openMeteoDaily" — matches Open-Meteo's own default (vs.
// extended) forecast window, and mirrors the confidence-signaling NEA's own
// "4day" tag already does.
const HOURLY_CONFIDENCE_DAYS = 7;
const FORECAST_DAYS = 16;

// Open-Meteo's response is columnar — parallel arrays indexed by hour/day,
// not an object per hour the way NEA has an object per area/period. Typed
// loosely and curled by hand before trusting it: Open-Meteo has used both
// `weathercode`/`weather_code` and `windspeed_10m`/`wind_speed_10m` across
// API versions, so this shape was confirmed against a live response, not
// assumed from docs (same trap NOTES.md documents for NEA).
type OpenMeteoRawResponse = {
  hourly: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
    uv_index: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
};

export async function fetchOpenMeteoForecast(
  latitude: number,
  longitude: number,
): Promise<OpenMeteoRawResponse> {
  const url = new URL(BASE_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "hourly",
    "temperature_2m,weathercode,uv_index,wind_speed_10m,wind_direction_10m,is_day",
  );
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  // UTC, not "auto" — Open-Meteo's local-timezone timestamps carry no
  // timezone suffix at all (e.g. "2026-08-17T00:00"), which is ambiguous to
  // parse safely. UTC keeps every timestamp explicit, avoiding the device's
  // own timezone entirely.
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("windspeed_unit", "kmh");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);
  return res.json();
}

/** Appending "Z" is what makes a UTC-timezone Open-Meteo timestamp (no
 * offset suffix of its own) parse as UTC rather than the runtime's local
 * time. */
function parseUtc(time: string): Date {
  return new Date(`${time}Z`);
}

/**
 * Given a slot's start time and Open-Meteo's raw forecast for one point,
 * finds the nearest hourly reading and normalizes it to the same
 * `SlotForecast` shape NEA's tiers produce.
 *
 * Unlike NEA's period/area lookups, this is a straight nearest-index zip —
 * Open-Meteo's arrays are already keyed to one exact coordinate, so there is
 * no nearest-area/region matching step to do.
 */
export function normalizeOpenMeteoForecast(
  json: OpenMeteoRawResponse,
  slotStartTime: string,
  now: Date = new Date(),
): SlotForecast {
  const slotTime = new Date(slotStartTime);
  const times = json.hourly.time.map(parseUtc);

  if (times.length === 0 || slotTime.getTime() > times[times.length - 1].getTime()) {
    return { forecast: "Forecast not yet available", source: "unavailable" };
  }

  let nearestIndex = 0;
  let nearestDelta = Math.abs(slotTime.getTime() - times[0].getTime());
  for (let i = 1; i < times.length; i++) {
    const delta = Math.abs(slotTime.getTime() - times[i].getTime());
    if (delta < nearestDelta) {
      nearestIndex = i;
      nearestDelta = delta;
    }
  }

  // That day's min/max, not the hourly point value — reuses `SlotForecast`'s
  // existing `{low,high}` shape with no UI changes, and mirrors how NEA's
  // own `general.temperature` is already a whole-day range, not
  // period-specific.
  const dayKey = json.hourly.time[nearestIndex].split("T")[0];
  const dayIndex = json.daily.time.indexOf(dayKey);
  const temperature =
    dayIndex >= 0
      ? {
          low: json.daily.temperature_2m_min[dayIndex],
          high: json.daily.temperature_2m_max[dayIndex],
        }
      : undefined;

  const hoursOut =
    (times[nearestIndex].getTime() - now.getTime()) / 1000 / 60 / 60;
  const source: SlotForecast["source"] =
    hoursOut <= HOURLY_CONFIDENCE_DAYS * 24 ? "openMeteoHourly" : "openMeteoDaily";

  const windSpeed = json.hourly.wind_speed_10m[nearestIndex];

  return {
    forecast: wmoCodeToForecastText(
      json.hourly.weathercode[nearestIndex],
      json.hourly.is_day[nearestIndex] === 1,
    ),
    source,
    temperature,
    // A single point reading, not a range — low/high are equal so the type
    // stays the same shape NEA's tiers use.
    wind: {
      speed: { low: windSpeed, high: windSpeed },
      direction: degreesToCompass(json.hourly.wind_direction_10m[nearestIndex]),
    },
    // Taken at the matched hour, not `daily`'s max — an evening slot
    // shouldn't inherit the day's midday UV peak.
    uvIndex: json.hourly.uv_index[nearestIndex],
    // Open-Meteo's response carries no model-run/issue timestamp
    // (`generationtime_ms` is processing time, not data freshness) — "when
    // we fetched it" is the honest answer, same idea as the cache's own
    // `cachedAt`.
    updatedAt: now.toISOString(),
  };
}

export async function getOpenMeteoForecastForSlot(
  latitude: number,
  longitude: number,
  slotStartTime: string,
): Promise<SlotForecast> {
  try {
    const json = await fetchOpenMeteoForecast(latitude, longitude);
    return normalizeOpenMeteoForecast(json, slotStartTime);
  } catch {
    return { forecast: "Couldn't load forecast", source: "error" };
  }
}
