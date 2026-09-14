import type { SlotForecast } from "@/services/weather";

/**
 * The slice of a key/value store this needs. Declared structurally rather
 * than importing `mmkvStorage`, so the logic stays testable — anything
 * importing MMKV pulls in a native module Jest can't load.
 */
export type CacheStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type CacheEntry = {
  forecast: SlotForecast;
  cachedAt: string;
};

const KEY_PREFIX = "brelly-forecast:";

/**
 * How long a stored forecast stays worth showing. A day covers an overnight
 * loss of connectivity; past that the reading is more misleading than useful,
 * and "No forecast" is the honest answer.
 */
export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function forecastCacheKey(params: {
  latitude: number;
  longitude: number;
  slotStartTime: string;
}): string {
  const { latitude, longitude, slotStartTime } = params;
  // Coordinates are rounded so trivially different picks for the same place
  // share a cache entry; 4dp is ~11m, well inside one NEA area.
  return `${KEY_PREFIX}${latitude.toFixed(4)},${longitude.toFixed(4)}@${slotStartTime}`;
}

/**
 * Stores a forecast for later offline use. Placeholder results are ignored —
 * caching "Couldn't load forecast" would mean serving the failure back as
 * though it were the last thing we knew.
 */
export function writeCachedForecast(
  storage: CacheStorage,
  key: string,
  forecast: SlotForecast,
  now: Date = new Date(),
): void {
  if (
    forecast.source === "error" ||
    forecast.source === "unavailable" ||
    forecast.source === "cached"
  ) {
    return;
  }

  const entry: CacheEntry = { forecast, cachedAt: now.toISOString() };
  storage.setItem(key, JSON.stringify(entry));
}

/**
 * The last forecast stored for this slot, re-tagged as `source: "cached"` so
 * the UI can label it as stale rather than passing it off as live.
 * Returns null when there's nothing stored, the entry has aged out, or the
 * stored JSON is unreadable (a partial write, or a format from an older
 * version of the app).
 */
export function readCachedForecast(
  storage: CacheStorage,
  key: string,
  now: Date = new Date(),
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): SlotForecast | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  let entry: CacheEntry;
  try {
    entry = JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }

  if (!entry?.forecast?.forecast || !entry.cachedAt) return null;

  const age = now.getTime() - new Date(entry.cachedAt).getTime();
  if (Number.isNaN(age) || age > maxAgeMs) return null;

  return { ...entry.forecast, source: "cached", cachedAt: entry.cachedAt };
}
