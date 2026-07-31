import type { NeaRegion, PsiReading, UvIndexReading } from "@/types/weather";

const BASE_URL = "https://api-open.data.gov.sg/v2/real-time/api";

/**
 * 24-hourly PSI per region. NEA returns a dozen sub-indices in one
 * `readings` object keyed by pollutant; `psi_twenty_four_hourly` is the
 * headline number, and `pm25_twenty_four_hourly` is what usually drives it
 * during haze.
 */
export async function fetchPsi(): Promise<PsiReading> {
  const res = await fetch(`${BASE_URL}/psi`);
  if (!res.ok) throw new Error(`NEA PSI API error: ${res.status}`);
  return normalizePsi(await res.json());
}

export function normalizePsi(json: {
  data: {
    items: {
      updatedTimestamp: string;
      readings: {
        psi_twenty_four_hourly: Record<NeaRegion, number>;
        pm25_twenty_four_hourly: Record<NeaRegion, number>;
      };
    }[];
  };
}): PsiReading {
  const item = json.data.items[0];

  return {
    updatedTimestamp: item.updatedTimestamp,
    psi: item.readings.psi_twenty_four_hourly,
    pm25: item.readings.pm25_twenty_four_hourly,
  };
}

/**
 * The most recent hourly UV index.
 *
 * The endpoint is `/uv`, not `/uv-index` — the latter returns "Missing
 * Authentication Token" rather than a 404, which reads like a credentials
 * problem instead of a wrong path.
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
