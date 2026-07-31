import type { SlotForecast } from "@/services/weather";
import {
  DEFAULT_MAX_AGE_MS,
  forecastCacheKey,
  readCachedForecast,
  writeCachedForecast,
  type CacheStorage,
} from "@/utils/forecastCache";

function fakeStorage(initial: Record<string, string> = {}): CacheStorage & {
  contents: Record<string, string>;
} {
  const contents = { ...initial };
  return {
    contents,
    getItem: (key) => contents[key] ?? null,
    setItem: (key, value) => {
      contents[key] = value;
    },
  };
}

const LIVE_FORECAST: SlotForecast = {
  forecast: "Thundery Showers",
  source: "24hr",
  temperature: { low: 25, high: 34 },
  updatedAt: "2026-07-31T11:40:57+08:00",
};

const NOW = new Date("2026-07-31T14:00:00+08:00");

describe("forecastCacheKey", () => {
  it("is stable for the same slot", () => {
    const params = { latitude: 1.3521, longitude: 103.8198, slotStartTime: "2026-07-31T18:00:00Z" };
    expect(forecastCacheKey(params)).toBe(forecastCacheKey(params));
  });

  it("collapses coordinates that differ below ~11m", () => {
    expect(
      forecastCacheKey({ latitude: 1.35211, longitude: 103.81982, slotStartTime: "t" }),
    ).toBe(
      forecastCacheKey({ latitude: 1.35213, longitude: 103.81984, slotStartTime: "t" }),
    );
  });

  it("separates different places", () => {
    expect(
      forecastCacheKey({ latitude: 1.3521, longitude: 103.8198, slotStartTime: "t" }),
    ).not.toBe(
      forecastCacheKey({ latitude: 1.4168, longitude: 103.9673, slotStartTime: "t" }),
    );
  });

  it("separates different start times at the same place", () => {
    expect(
      forecastCacheKey({ latitude: 1.3521, longitude: 103.8198, slotStartTime: "a" }),
    ).not.toBe(
      forecastCacheKey({ latitude: 1.3521, longitude: 103.8198, slotStartTime: "b" }),
    );
  });
});

describe("writeCachedForecast / readCachedForecast", () => {
  it("round-trips a forecast, re-tagged as cached", () => {
    const storage = fakeStorage();
    writeCachedForecast(storage, "k", LIVE_FORECAST, NOW);

    expect(readCachedForecast(storage, "k", NOW)).toEqual({
      ...LIVE_FORECAST,
      source: "cached",
      cachedAt: NOW.toISOString(),
    });
  });

  it("preserves temperature and the NEA update time through the round trip", () => {
    const storage = fakeStorage();
    writeCachedForecast(storage, "k", LIVE_FORECAST, NOW);
    const cached = readCachedForecast(storage, "k", NOW);

    expect(cached?.temperature).toEqual({ low: 25, high: 34 });
    expect(cached?.updatedAt).toBe("2026-07-31T11:40:57+08:00");
  });

  it("does not store a failed fetch", () => {
    const storage = fakeStorage();
    writeCachedForecast(
      storage,
      "k",
      { forecast: "Couldn't load forecast", source: "error" },
      NOW,
    );

    expect(storage.contents).toEqual({});
  });

  it("does not store an unavailable placeholder", () => {
    const storage = fakeStorage();
    writeCachedForecast(
      storage,
      "k",
      { forecast: "Forecast unavailable", source: "unavailable" },
      NOW,
    );

    expect(readCachedForecast(storage, "k", NOW)).toBeNull();
  });

  it("does not re-cache an already-cached read, which would reset its age", () => {
    const storage = fakeStorage();
    writeCachedForecast(storage, "k", LIVE_FORECAST, NOW);
    const cached = readCachedForecast(storage, "k", NOW)!;

    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    writeCachedForecast(storage, "k", cached, later);

    expect(readCachedForecast(storage, "k", later)?.cachedAt).toBe(NOW.toISOString());
  });

  it("returns null when nothing is stored", () => {
    expect(readCachedForecast(fakeStorage(), "k", NOW)).toBeNull();
  });

  it("returns null once the entry is older than the max age", () => {
    const storage = fakeStorage();
    writeCachedForecast(storage, "k", LIVE_FORECAST, NOW);

    const tooLate = new Date(NOW.getTime() + DEFAULT_MAX_AGE_MS + 1000);
    expect(readCachedForecast(storage, "k", tooLate)).toBeNull();
  });

  it("still returns an entry just inside the max age", () => {
    const storage = fakeStorage();
    writeCachedForecast(storage, "k", LIVE_FORECAST, NOW);

    const justInside = new Date(NOW.getTime() + DEFAULT_MAX_AGE_MS - 1000);
    expect(readCachedForecast(storage, "k", justInside)).not.toBeNull();
  });

  it("returns null for unparseable stored JSON rather than throwing", () => {
    expect(readCachedForecast(fakeStorage({ k: "{not json" }), "k", NOW)).toBeNull();
  });

  it("returns null for a stored entry in an unrecognized shape", () => {
    const storage = fakeStorage({ k: JSON.stringify({ something: "else" }) });
    expect(readCachedForecast(storage, "k", NOW)).toBeNull();
  });
});
