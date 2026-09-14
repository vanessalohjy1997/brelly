import {
  fetchOpenMeteoForecast,
  getOpenMeteoForecastForSlot,
  normalizeOpenMeteoForecast,
} from "@/services/openMeteo";

// Trimmed to a few hours/one day, but the key names and shape mirror a real
// curl of api.open-meteo.com/v1/forecast (?hourly=temperature_2m,weathercode,
// uv_index,wind_speed_10m,wind_direction_10m,is_day&daily=temperature_2m_max,
// temperature_2m_min&timezone=UTC) — confirmed by hand, not assumed from
// docs: the field is `weathercode`, not `weather_code`, and hourly.time
// carries no timezone suffix at all when timezone=UTC.
const FIXTURE = {
  hourly: {
    time: ["2026-08-17T10:00", "2026-08-17T11:00", "2026-08-17T12:00"],
    temperature_2m: [30.1, 31.2, 32.0],
    weathercode: [3, 61, 95],
    uv_index: [5.4, 7.5, 8.1],
    wind_speed_10m: [9.2, 10.1, 11.0],
    wind_direction_10m: [223, 210, 200],
    is_day: [1, 1, 1],
  },
  daily: {
    time: ["2026-08-17"],
    temperature_2m_max: [34.7],
    temperature_2m_min: [26.1],
  },
};

describe("normalizeOpenMeteoForecast", () => {
  it("matches the nearest hourly reading to the slot's start time", () => {
    const now = new Date("2026-08-17T00:00:00Z");
    // 11:20 is 20 minutes from 11:00 and 40 minutes from 12:00 — nearer to
    // the 11:00 entry (weathercode 61 → "Light Rain").
    const result = normalizeOpenMeteoForecast(
      FIXTURE,
      "2026-08-17T11:20:00Z",
      now,
    );

    expect(result.forecast).toBe("Light Rain");
    expect(result.uvIndex).toBe(7.5);
    expect(result.wind).toEqual({
      speed: { low: 10.1, high: 10.1 },
      direction: "SSW",
    });
  });

  it("uses that day's min/max from the daily block, not the hourly point value", () => {
    const result = normalizeOpenMeteoForecast(
      FIXTURE,
      "2026-08-17T11:20:00Z",
      new Date("2026-08-17T00:00:00Z"),
    );

    expect(result.temperature).toEqual({ low: 26.1, high: 34.7 });
  });

  it("tags a slot within 7 days as openMeteoHourly", () => {
    const result = normalizeOpenMeteoForecast(
      FIXTURE,
      "2026-08-17T11:50:00Z",
      new Date("2026-08-17T00:00:00Z"),
    );

    expect(result.source).toBe("openMeteoHourly");
  });

  it("tags a slot beyond 7 days as openMeteoDaily", () => {
    const farFixture = {
      hourly: {
        time: ["2026-08-25T12:00"],
        temperature_2m: [29.0],
        weathercode: [2],
        uv_index: [6.0],
        wind_speed_10m: [8.0],
        wind_direction_10m: [90],
        is_day: [1],
      },
      daily: {
        time: ["2026-08-25"],
        temperature_2m_max: [31.0],
        temperature_2m_min: [24.0],
      },
    };

    const result = normalizeOpenMeteoForecast(
      farFixture,
      "2026-08-25T12:00:00Z",
      new Date("2026-08-17T00:00:00Z"),
    );

    expect(result.source).toBe("openMeteoDaily");
  });

  it("returns 'unavailable' when the slot is beyond the last hourly entry", () => {
    const result = normalizeOpenMeteoForecast(
      FIXTURE,
      "2026-09-05T12:00:00Z",
      new Date("2026-08-17T00:00:00Z"),
    );

    expect(result).toEqual({
      forecast: "Forecast not yet available",
      source: "unavailable",
    });
  });

  it("translates a thunderstorm code to text containing 'thunder'", () => {
    const result = normalizeOpenMeteoForecast(
      FIXTURE,
      "2026-08-17T12:00:00Z",
      new Date("2026-08-17T00:00:00Z"),
    );

    expect(result.forecast.toLowerCase()).toContain("thunder");
  });
});

describe("getOpenMeteoForecastForSlot", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fetches and normalizes a real-shaped response", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(FIXTURE),
      } as Response),
    ) as unknown as typeof fetch;

    const result = await getOpenMeteoForecastForSlot(
      13.7563,
      100.5018,
      "2026-08-17T11:20:00Z",
    );

    expect(result.forecast).toBe("Light Rain");
    expect(result.source).toMatch(/^openMeteo/);
  });

  it("returns source 'error' when the request fails", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 503 } as Response),
    ) as unknown as typeof fetch;

    const result = await getOpenMeteoForecastForSlot(
      13.7563,
      100.5018,
      "2026-08-17T11:20:00Z",
    );

    expect(result).toEqual({
      forecast: "Couldn't load forecast",
      source: "error",
    });
  });
});

describe("fetchOpenMeteoForecast", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests explicit units and a pinned UTC timezone rather than relying on API defaults", async () => {
    const fetchMock = jest.fn((_input: string | URL) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(FIXTURE),
      } as Response),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchOpenMeteoForecast(13.7563, 100.5018);

    const requestedUrl = new URL(fetchMock.mock.calls[0][0].toString());
    expect(requestedUrl.searchParams.get("timezone")).toBe("UTC");
    expect(requestedUrl.searchParams.get("temperature_unit")).toBe("celsius");
    expect(requestedUrl.searchParams.get("windspeed_unit")).toBe("kmh");
    expect(requestedUrl.searchParams.get("latitude")).toBe("13.7563");
    expect(requestedUrl.searchParams.get("longitude")).toBe("100.5018");
  });

  it("throws on a non-2xx response", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    ) as unknown as typeof fetch;

    await expect(fetchOpenMeteoForecast(13.7563, 100.5018)).rejects.toThrow(
      "Open-Meteo API error: 500",
    );
  });
});
