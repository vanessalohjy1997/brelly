import type { UvIndexReading } from "@/types/weather";

const BASE_URL = "https://api-open.data.gov.sg/v2/real-time/api";

/**
 * The most recent hourly UV index.
 *
 * The endpoint is `/uv`, not `/uv-index` — the latter returns "Missing
 * Authentication Token" rather than a 404, which reads like a credentials
 * problem instead of a wrong path.
 *
 * There is no region parameter — NEA publishes one island-wide UV figure.
 * That's why nothing on the UV path needs a location, unlike the forecast
 * tiers, and why `useUvIndex` can run before any permission is granted.
 */
export async function fetchUvIndex(): Promise<UvIndexReading> {
  const res = await fetch(`${BASE_URL}/uv`);
  if (!res.ok) throw new Error(`NEA UV API error: ${res.status}`);
  return normalizeUvIndex(await res.json());
}

export function normalizeUvIndex(json: {
  data: {
    records: {
      updatedTimestamp: string;
      index: { value: number; hour: string }[];
    }[];
  };
}): UvIndexReading {
  const record = json.data.records[0];
  // `index` holds every hour so far today. It arrives newest-first in
  // practice, but that's not guaranteed anywhere — pick by hour instead.
  const latest = record.index.reduce((newest, entry) =>
    new Date(entry.hour).getTime() > new Date(newest.hour).getTime()
      ? entry
      : newest,
  );

  return {
    updatedTimestamp: record.updatedTimestamp,
    value: latest.value,
    hour: latest.hour,
  };
}
