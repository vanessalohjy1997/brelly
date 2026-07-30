import { findNearestArea } from "@/constants/neaRegions";
import {
  FourDayForecast,
  NeaRegion,
  TwentyFourHrForecast,
  TwoHrForecast,
} from "@/types/weather";

const BASE_URL = "https://api-open.data.gov.sg/v2/real-time/api";

// ─── API calls ────────────────────────────────────────────────────────────────
// NEA nests every forecast string as { code, text } and uses field names that
// don't match a natural TS shape (e.g. `forecasts[].area` not `areas[].name`,
// per-item `timestamp` not `date`) — normalized to our own types below.

export async function fetchTwentyFourHrForecast(
  date?: string,
): Promise<TwentyFourHrForecast[]> {
  const url = new URL(`${BASE_URL}/twenty-four-hr-forecast`);
  if (date) url.searchParams.set("date", date);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NEA 24hr API error: ${res.status}`);

  const json = await res.json();
  // API returns { code: 0, data: { records: [...] } }
  return json.data.records as TwentyFourHrForecast[];
}

export async function fetchTwoHrForecast(
  dateTime?: string,
): Promise<TwoHrForecast> {
  const url = new URL(`${BASE_URL}/two-hr-forecast`);
  if (dateTime) url.searchParams.set("date", dateTime);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NEA 2hr API error: ${res.status}`);

  const json = await res.json();
  const item = json.data.items[0];

  return {
    timestamp: item.timestamp,
    validPeriod: {
      start: item.valid_period.start,
      end: item.valid_period.end,
    },
    areas: item.forecasts.map((f: { area: string; forecast: string }) => ({
      name: f.area,
      forecast: f.forecast,
    })),
    areaMetadata: json.data.area_metadata.map(
      (a: {
        name: string;
        label_location: { latitude: number; longitude: number };
      }) => ({
        name: a.name,
        latitude: a.label_location.latitude,
        longitude: a.label_location.longitude,
      }),
    ),
  };
}

export async function fetchFourDayForecast(): Promise<FourDayForecast[]> {
  const res = await fetch(`${BASE_URL}/four-day-outlook`);
  if (!res.ok) throw new Error(`NEA 4-day API error: ${res.status}`);
  const json = await res.json();
  return json.data.records[0].forecasts as FourDayForecast[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given a slot's start time and coordinates, decides which API to use and
 * returns the most accurate forecast string available.
 */
export async function getForecastForSlot(
  region: NeaRegion,
  latitude: number,
  longitude: number,
  slotStartTime: string,
): Promise<{
  forecast: string;
  source: "2hr" | "24hr" | "4day" | "unavailable";
}> {
  const slotTime = new Date(slotStartTime);
  const now = new Date();
  const minutesUntilSlot = (slotTime.getTime() - now.getTime()) / 1000 / 60;
  const daysUntilSlot = minutesUntilSlot / 60 / 24;

  // Beyond 4 days — no forecast available yet
  if (daysUntilSlot > 4) {
    return { forecast: "Forecast not yet available", source: "unavailable" };
  }

  // Within 90 minutes — use 2hr nowcast (most accurate, area-level)
  if (minutesUntilSlot <= 90) {
    try {
      const twoHr = await fetchTwoHrForecast(slotStartTime);
      const nearestAreaName = findNearestArea(
        latitude,
        longitude,
        twoHr.areaMetadata,
      );
      const areaForecast = twoHr.areas.find(
        (a) => a.name === nearestAreaName,
      );
      if (areaForecast) {
        return { forecast: areaForecast.forecast, source: "2hr" };
      }
    } catch {
      // fall through
    }
  }

  // Within today — use 24hr forecast (region-level, time-period aware)
  if (daysUntilSlot <= 1) {
    try {
      const dateStr = slotStartTime.split("T")[0];
      const records = await fetchTwentyFourHrForecast(dateStr);
      const record = records[0];
      const matchingPeriod = record?.periods.find((p) => {
        const start = new Date(p.timePeriod.start);
        const end = new Date(p.timePeriod.end);
        return slotTime >= start && slotTime < end;
      });
      const forecast =
        matchingPeriod?.regions[region]?.text ??
        record?.general.forecast?.text ??
        null;
      if (forecast) return { forecast, source: "24hr" };
    } catch {
      // fall through
    }
  }

  // 1–4 days ahead — use 4-day forecast (island-wide, day-level only)
  try {
    const fourDay = await fetchFourDayForecast();
    const slotDateStr = slotStartTime.split("T")[0];
    const dayForecast = fourDay.find((f) =>
      f.timestamp.startsWith(slotDateStr),
    );
    if (dayForecast) {
      return { forecast: dayForecast.forecast.text, source: "4day" };
    }
  } catch {
    // fall through
  }

  return { forecast: "Forecast unavailable", source: "unavailable" };
}
