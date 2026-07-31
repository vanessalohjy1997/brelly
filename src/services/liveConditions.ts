import { findNearest } from "@/constants/neaRegions";
import type {
  LiveConditions,
  StationDataset,
  StationReadings,
} from "@/types/weather";

const BASE_URL = "https://api-open.data.gov.sg/v2/real-time/api";

/**
 * Real-time sensor readings, as distinct from the forecast endpoints in
 * `weather.ts`: these are what a station *measured*, not what NEA predicts.
 * All four datasets share one response shape — `{ stations, readings }`, where
 * `readings[0]` is the latest batch and its `data` array keys values by
 * `stationId` (not by station name, and not in station order).
 */
export async function fetchStationReadings(
  dataset: StationDataset,
): Promise<StationReadings> {
  const res = await fetch(`${BASE_URL}/${dataset}`);
  if (!res.ok) throw new Error(`NEA ${dataset} API error: ${res.status}`);

  const json = await res.json();
  return normalizeStationReadings(json);
}

/**
 * Split out from the fetch so the parsing — the part that has historically
 * been wrong about NEA's shapes — is testable against a captured response.
 */
export function normalizeStationReadings(json: {
  data: {
    stations: {
      id: string;
      name: string;
      location: { latitude: number; longitude: number };
    }[];
    readings: { timestamp: string; data: { stationId: string; value: number }[] }[];
  };
}): StationReadings {
  const latest = json.data.readings[0];

  return {
    timestamp: latest?.timestamp ?? "",
    stations: json.data.stations.map((station) => ({
      id: station.id,
      name: station.name,
      latitude: station.location.latitude,
      longitude: station.location.longitude,
    })),
    values: Object.fromEntries(
      (latest?.data ?? []).map((reading) => [reading.stationId, reading.value]),
    ),
  };
}

/**
 * Picks the value from whichever station reporting this dataset is nearest to
 * the given point. Stations are filtered to those that actually reported in
 * the latest batch first — the `stations` list includes sensors that are
 * offline or absent from `readings`, and the nearest one is often one of them.
 */
export function readingNearest(
  readings: StationReadings,
  latitude: number,
  longitude: number,
): { stationName: string; value: number } | null {
  const reporting = readings.stations.filter(
    (station) => readings.values[station.id] !== undefined,
  );
  const nearest = findNearest(latitude, longitude, reporting);
  if (!nearest) return null;

  return { stationName: nearest.name, value: readings.values[nearest.id] };
}

/**
 * What the sensors nearest a location are measuring right now.
 *
 * Each dataset is fetched independently and a failure of any one is absorbed —
 * a missing humidity sensor shouldn't cost the caller the rainfall reading,
 * which is the one that answers "is it raining on me". Returns null only if
 * every dataset failed or none had a reporting station.
 */
export async function getLiveConditions(
  latitude: number,
  longitude: number,
): Promise<LiveConditions | null> {
  const datasets: StationDataset[] = [
    "rainfall",
    "air-temperature",
    "relative-humidity",
    "wind-speed",
  ];

  const results = await Promise.all(
    datasets.map(async (dataset) => {
      try {
        return { dataset, readings: await fetchStationReadings(dataset) };
      } catch {
        return null;
      }
    }),
  );

  return buildLiveConditions(
    results.filter((r) => r !== null),
    latitude,
    longitude,
  );
}

/** The pure half of `getLiveConditions`, so the assembly can be tested. */
export function buildLiveConditions(
  results: { dataset: StationDataset; readings: StationReadings }[],
  latitude: number,
  longitude: number,
): LiveConditions | null {
  const conditions: LiveConditions = { stationName: "", observedAt: "" };
  let matched = false;

  for (const { dataset, readings } of results) {
    const nearest = readingNearest(readings, latitude, longitude);
    if (!nearest) continue;

    // Rainfall names the reading: it's the one the user is being shown, and
    // its network is the densest, so it's the closest station of the four.
    if (!matched || dataset === "rainfall") {
      conditions.stationName = nearest.stationName;
      conditions.observedAt = readings.timestamp;
    }
    matched = true;

    switch (dataset) {
      case "rainfall":
        conditions.rainfallMm = nearest.value;
        break;
      case "air-temperature":
        conditions.temperatureC = nearest.value;
        break;
      case "relative-humidity":
        conditions.humidityPercent = nearest.value;
        break;
      case "wind-speed":
        conditions.windSpeedKn = nearest.value;
        break;
    }
  }

  return matched ? conditions : null;
}
