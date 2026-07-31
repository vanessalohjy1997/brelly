import {
  fetchPsi,
  fetchUvIndex,
  normalizePsi,
  normalizeUvIndex,
} from "@/services/airQuality";

// Mirrors a live `/v2/real-time/api/psi` response — `readings` holds a dozen
// pollutant sub-indices side by side, each keyed by region.
const PSI_RESPONSE = {
  code: 0,
  data: {
    regionMetadata: [
      { name: "east", labelLocation: { latitude: 1.35735, longitude: 103.94 } },
    ],
    items: [
      {
        date: "2026-07-31",
        updatedTimestamp: "2026-07-31T14:00:41+08:00",
        timestamp: "2026-07-31T14:00:00+08:00",
        readings: {
          pm10_twenty_four_hourly: { north: 23, central: 30, south: 32, east: 34, west: 32 },
          o3_sub_index: { north: 10, west: 5, central: 12, south: 8, east: 12 },
          psi_twenty_four_hourly: { west: 52, south: 51, central: 57, north: 52, east: 52 },
          pm25_twenty_four_hourly: { north: 13, south: 12, west: 13, east: 13, central: 18 },
        },
      },
    ],
  },
};

// Mirrors `/v2/real-time/api/uv` — `index` holds every hour recorded so far
// today, and the API happens to return it newest-first.
const UV_RESPONSE = {
  code: 0,
  data: {
    records: [
      {
        date: "2026-07-31",
        updatedTimestamp: "2026-07-31T13:10:57+08:00",
        timestamp: "2026-07-31T13:00:00+08:00",
        index: [
          { value: 8, hour: "2026-07-31T13:00:00+08:00" },
          { value: 6, hour: "2026-07-31T12:00:00+08:00" },
          { value: 3, hour: "2026-07-31T11:00:00+08:00" },
          { value: 0, hour: "2026-07-31T07:00:00+08:00" },
        ],
      },
    ],
  },
};

function mockJsonFetch(body: unknown) {
  return jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response),
  ) as unknown as typeof fetch;
}

describe("normalizePsi", () => {
  it("picks the headline PSI and PM2.5 sub-indices out of the readings blob", () => {
    expect(normalizePsi(PSI_RESPONSE)).toEqual({
      updatedTimestamp: "2026-07-31T14:00:41+08:00",
      psi: { west: 52, south: 51, central: 57, north: 52, east: 52 },
      pm25: { north: 13, south: 12, west: 13, east: 13, central: 18 },
    });
  });

  it("reads a region's value by name", () => {
    expect(normalizePsi(PSI_RESPONSE).psi.central).toBe(57);
  });
});

describe("normalizeUvIndex", () => {
  it("returns the most recent hourly reading", () => {
    expect(normalizeUvIndex(UV_RESPONSE)).toEqual({
      updatedTimestamp: "2026-07-31T13:10:57+08:00",
      value: 8,
      hour: "2026-07-31T13:00:00+08:00",
    });
  });

  it("picks by hour rather than trusting the array order", () => {
    const shuffled = {
      data: {
        records: [
          {
            updatedTimestamp: "2026-07-31T13:10:57+08:00",
            index: [
              { value: 3, hour: "2026-07-31T11:00:00+08:00" },
              { value: 8, hour: "2026-07-31T13:00:00+08:00" },
              { value: 6, hour: "2026-07-31T12:00:00+08:00" },
            ],
          },
        ],
      },
    };

    expect(normalizeUvIndex(shuffled).value).toBe(8);
  });

  it("handles a single overnight reading", () => {
    const overnight = {
      data: {
        records: [
          {
            updatedTimestamp: "2026-07-31T07:10:00+08:00",
            index: [{ value: 0, hour: "2026-07-31T07:00:00+08:00" }],
          },
        ],
      },
    };

    expect(normalizeUvIndex(overnight).value).toBe(0);
  });
});

describe("fetchPsi", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws on a non-ok response", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 503 } as Response),
    ) as unknown as typeof fetch;

    await expect(fetchPsi()).rejects.toThrow("NEA PSI API error: 503");
  });

  it("returns the normalized reading", async () => {
    globalThis.fetch = mockJsonFetch(PSI_RESPONSE);
    await expect(fetchPsi()).resolves.toMatchObject({ psi: { central: 57 } });
  });
});

describe("fetchUvIndex", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests /uv — /uv-index answers with an auth error, not a 404", async () => {
    const fetchMock = mockJsonFetch(UV_RESPONSE);
    globalThis.fetch = fetchMock;

    await fetchUvIndex();

    expect((fetchMock as jest.Mock).mock.calls[0][0]).toMatch(/\/uv$/);
  });

  it("throws on a non-ok response", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    ) as unknown as typeof fetch;

    await expect(fetchUvIndex()).rejects.toThrow("NEA UV API error: 500");
  });
});
