import {
  buildLiveConditions,
  getLiveConditions,
  normalizeStationReadings,
  readingNearest,
} from "@/services/liveConditions";
import type { StationDataset, StationReadings } from "@/types/weather";

// Mirrors a live `/v2/real-time/api/rainfall` response: stations carry their
// coordinates under `location`, readings are a list of batches (newest first)
// whose `data` entries key values by `stationId`.
const RAINFALL_RESPONSE = {
  code: 0,
  data: {
    stations: [
      {
        id: "S218",
        deviceId: "S218",
        name: "Bukit Batok Street 34",
        location: { latitude: 1.36491, longitude: 103.75065 },
      },
      {
        id: "S214",
        deviceId: "S214",
        name: "Tanjong Rhu",
        location: { latitude: 1.29911, longitude: 103.88289 },
      },
      {
        id: "S999",
        deviceId: "S999",
        name: "Offline Sensor",
        // Deliberately the closest station to the query point below, but
        // absent from the readings batch — the real API lists sensors that
        // aren't currently reporting.
        location: { latitude: 1.3, longitude: 103.883 },
      },
    ],
    readings: [
      {
        timestamp: "2026-07-31T14:10:00+08:00",
        data: [
          { stationId: "S218", value: 0 },
          { stationId: "S214", value: 4.2 },
        ],
      },
    ],
  },
};

function readingsFor(
  values: Record<string, number>,
  timestamp = "2026-07-31T14:10:00+08:00",
): StationReadings {
  return {
    timestamp,
    stations: [
      { id: "S218", name: "Bukit Batok Street 34", latitude: 1.36491, longitude: 103.75065 },
      { id: "S214", name: "Tanjong Rhu", latitude: 1.29911, longitude: 103.88289 },
    ],
    values,
  };
}

describe("normalizeStationReadings", () => {
  it("flattens station coordinates and keys the latest batch by station id", () => {
    expect(normalizeStationReadings(RAINFALL_RESPONSE)).toEqual({
      timestamp: "2026-07-31T14:10:00+08:00",
      stations: [
        { id: "S218", name: "Bukit Batok Street 34", latitude: 1.36491, longitude: 103.75065 },
        { id: "S214", name: "Tanjong Rhu", latitude: 1.29911, longitude: 103.88289 },
        { id: "S999", name: "Offline Sensor", latitude: 1.3, longitude: 103.883 },
      ],
      values: { S218: 0, S214: 4.2 },
    });
  });

  it("survives an empty readings list", () => {
    expect(
      normalizeStationReadings({
        data: { stations: [], readings: [] },
      }),
    ).toEqual({ timestamp: "", stations: [], values: {} });
  });
});

describe("readingNearest", () => {
  it("returns the value from the closest station", () => {
    // Coordinates beside Tanjong Rhu, far from Bukit Batok.
    expect(readingNearest(readingsFor({ S218: 0, S214: 4.2 }), 1.3, 103.882)).toEqual({
      stationName: "Tanjong Rhu",
      value: 4.2,
    });
  });

  it("skips a nearer station that did not report in this batch", () => {
    const readings = normalizeStationReadings(RAINFALL_RESPONSE);
    // "Offline Sensor" is nearest but has no value; the answer should be the
    // nearest *reporting* station instead of undefined.
    expect(readingNearest(readings, 1.3, 103.883)).toEqual({
      stationName: "Tanjong Rhu",
      value: 4.2,
    });
  });

  it("returns null when nothing reported at all", () => {
    expect(readingNearest(readingsFor({}), 1.3, 103.882)).toBeNull();
  });

  it("keeps a zero reading rather than treating it as missing", () => {
    expect(readingNearest(readingsFor({ S218: 0 }), 1.365, 103.75)).toEqual({
      stationName: "Bukit Batok Street 34",
      value: 0,
    });
  });
});

describe("buildLiveConditions", () => {
  const datasets = (
    entries: [StationDataset, Record<string, number>][],
  ): { dataset: StationDataset; readings: StationReadings }[] =>
    entries.map(([dataset, values]) => ({ dataset, readings: readingsFor(values) }));

  it("assembles each dataset's nearest reading into one snapshot", () => {
    const result = buildLiveConditions(
      datasets([
        ["rainfall", { S214: 1.4 }],
        ["air-temperature", { S214: 29.8 }],
        ["relative-humidity", { S214: 78.5 }],
        ["wind-speed", { S214: 6 }],
      ]),
      1.3,
      103.882,
    );

    expect(result).toEqual({
      stationName: "Tanjong Rhu",
      observedAt: "2026-07-31T14:10:00+08:00",
      rainfallMm: 1.4,
      temperatureC: 29.8,
      humidityPercent: 78.5,
      windSpeedKn: 6,
    });
  });

  it("still reports rainfall when the other sensors are missing", () => {
    const result = buildLiveConditions(
      datasets([["rainfall", { S214: 0.2 }]]),
      1.3,
      103.882,
    );

    expect(result).toMatchObject({ rainfallMm: 0.2 });
    expect(result?.temperatureC).toBeUndefined();
  });

  it("names the snapshot after the rainfall station when they differ", () => {
    // Temperature comes from a sparser network, so its nearest station is
    // often further away than the rainfall one the reading is attributed to.
    const result = buildLiveConditions(
      [
        { dataset: "air-temperature", readings: readingsFor({ S218: 31 }) },
        { dataset: "rainfall", readings: readingsFor({ S214: 2 }) },
      ],
      1.3,
      103.882,
    );

    expect(result?.stationName).toBe("Tanjong Rhu");
  });

  it("returns null when no dataset had a reporting station", () => {
    expect(buildLiveConditions(datasets([["rainfall", {}]]), 1.3, 103.882)).toBeNull();
  });

  it("returns null when every dataset failed to load", () => {
    expect(buildLiveConditions([], 1.3, 103.882)).toBeNull();
  });
});

describe("getLiveConditions", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("absorbs a failing dataset instead of losing the whole snapshot", async () => {
    globalThis.fetch = jest.fn((input: string | URL) => {
      const url = input.toString();
      if (url.includes("air-temperature")) {
        return Promise.resolve({ ok: false, status: 503 } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(RAINFALL_RESPONSE),
      } as Response);
    }) as unknown as typeof fetch;

    const result = await getLiveConditions(1.3, 103.882);

    expect(result).toMatchObject({ stationName: "Tanjong Rhu", rainfallMm: 4.2 });
    expect(result?.temperatureC).toBeUndefined();
  });

  it("returns null when every dataset fails", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 503 } as Response),
    ) as unknown as typeof fetch;

    expect(await getLiveConditions(1.3, 103.882)).toBeNull();
  });
});
