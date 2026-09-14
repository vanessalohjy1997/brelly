import { fetchUvIndex, normalizeUvIndex } from "@/services/airQuality";

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
