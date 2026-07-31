import { findNearestArea } from "@/constants/neaRegions";
import {
  FourDayOutlook,
  NeaRegion,
  NeaWind,
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
    updatedTimestamp: item.update_timestamp ?? item.timestamp,
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

export async function fetchFourDayForecast(): Promise<FourDayOutlook> {
  const res = await fetch(`${BASE_URL}/four-day-outlook`);
  if (!res.ok) throw new Error(`NEA 4-day API error: ${res.status}`);
  const json = await res.json();
  const record = json.data.records[0];
  return {
    // The update time lives on the record; each forecast's own `timestamp` is
    // the day it describes, not when it was issued.
    updatedTimestamp: record.updatedTimestamp,
    forecasts: record.forecasts,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export type SlotForecastSource =
  | "2hr"
  | "24hr"
  | "4day"
  | "cached"
  | "unavailable"
  | "error";

export type SlotForecast = {
  forecast: string;
  source: SlotForecastSource;
  // 2hr nowcasts don't carry temperature/humidity/wind — only 24hr and 4-day do.
  temperature?: { low: number; high: number };
  humidity?: { low: number; high: number };
  wind?: NeaWind;
  /**
   * When NEA last updated the reading this came from. Worth surfacing because
   * the tiers age very differently: a 2hr nowcast is minutes old, while the
   * 4-day outlook is issued once each morning and can be most of a day stale
   * by the time it's read.
   */
  updatedAt?: string;
  /** Set only on `source: "cached"` — when this app stored the reading. */
  cachedAt?: string;
};

/**
 * Given a slot's start time and coordinates, decides which API to use and
 * returns the most accurate forecast available.
 *
 * `source: "unavailable"` means every tier was queried successfully but none
 * had a matching entry. `source: "error"` means at least one tier's request
 * itself failed (network/API error) — distinct so the UI can tell "we don't
 * have this forecast" apart from "we couldn't reach NEA".
 */
export async function getForecastForSlot(
  region: NeaRegion,
  latitude: number,
  longitude: number,
  slotStartTime: string,
): Promise<SlotForecast> {
  const slotTime = new Date(slotStartTime);
  const now = new Date();
  const minutesUntilSlot = (slotTime.getTime() - now.getTime()) / 1000 / 60;
  const daysUntilSlot = minutesUntilSlot / 60 / 24;

  // Beyond 4 days — no forecast available yet
  if (daysUntilSlot > 4) {
    return { forecast: "Forecast not yet available", source: "unavailable" };
  }

  let hadFetchError = false;

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
        return {
          forecast: areaForecast.forecast,
          source: "2hr",
          updatedAt: twoHr.updatedTimestamp,
        };
      }
    } catch {
      hadFetchError = true;
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
      if (forecast) {
        return {
          forecast,
          source: "24hr",
          temperature: record.general.temperature,
          humidity: record.general.relativeHumidity,
          wind: record.general.wind,
          updatedAt: record.updatedTimestamp,
        };
      }
    } catch {
      hadFetchError = true;
    }
  }

  // 1–4 days ahead — use 4-day forecast (island-wide, day-level only)
  try {
    const fourDay = await fetchFourDayForecast();
    const slotDateStr = slotStartTime.split("T")[0];
    const dayForecast = fourDay.forecasts.find((f) =>
      f.timestamp.startsWith(slotDateStr),
    );
    if (dayForecast) {
      return {
        forecast: dayForecast.forecast.text,
        source: "4day",
        temperature: dayForecast.temperature,
        humidity: dayForecast.relativeHumidity,
        wind: dayForecast.wind,
        updatedAt: fourDay.updatedTimestamp,
      };
    }
  } catch {
    hadFetchError = true;
  }

  if (hadFetchError) {
    return { forecast: "Couldn't load forecast", source: "error" };
  }
  return { forecast: "Forecast unavailable", source: "unavailable" };
}

export type UpcomingPeriodForecast = {
  start: string;
  end: string;
  forecast: string;
  temperature: { low: number; high: number };
  humidity: { low: number; high: number };
};

/**
 * Region-level forecast for whatever's coming up in the next `hours` —
 * used for the "no plans yet" empty state rather than a specific slot.
 * Reuses the 24hr forecast's own time periods (NEA doesn't offer a finer
 * hourly breakdown) filtered to those overlapping the window from now.
 */
export async function getUpcomingForecast(
  region: NeaRegion,
  hours: number = 6,
): Promise<UpcomingPeriodForecast[]> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const records = await fetchTwentyFourHrForecast(
    now.toISOString().split("T")[0],
  );
  const record = records[0];
  if (!record) return [];

  return record.periods
    .filter((period) => {
      const start = new Date(period.timePeriod.start);
      const end = new Date(period.timePeriod.end);
      return end > now && start < windowEnd;
    })
    .map((period) => ({
      start: period.timePeriod.start,
      end: period.timePeriod.end,
      forecast:
        period.regions[region]?.text ?? record.general.forecast.text,
      temperature: record.general.temperature,
      humidity: record.general.relativeHumidity,
    }));
}
