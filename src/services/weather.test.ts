import { getForecastForSlot } from "@/services/weather";

// Fixtures mirror the *actual* data.gov.sg response shapes (verified via live
// curl — see PLAN.md), not the shapes originally assumed by the types. In
// particular: forecast strings are nested `{ code, text }` objects, the 2hr
// API keys areas by `forecasts[].area`, and 4-day items key their date by
// `timestamp`, not `date`.

const TWO_HR_FIXTURE = {
  code: 0,
  data: {
    area_metadata: [
      { name: "Ang Mo Kio", label_location: { latitude: 1.375, longitude: 103.839 } },
      { name: "Bedok", label_location: { latitude: 1.321, longitude: 103.924 } },
    ],
    items: [
      {
        timestamp: "2026-07-30T11:10:00+08:00",
        valid_period: {
          start: "2026-07-30T11:00:00+08:00",
          end: "2026-07-30T13:00:00+08:00",
        },
        forecasts: [
          { area: "Ang Mo Kio", forecast: "Cloudy" },
          { area: "Bedok", forecast: "Light Rain" },
        ],
      },
    ],
  },
};

function twentyFourHrFixture(periodStart: Date, periodEnd: Date) {
  return {
    code: 0,
    data: {
      records: [
        {
          date: "2026-07-30",
          updatedTimestamp: "2026-07-30T11:00:52+08:00",
          general: {
            forecast: { code: "TL", text: "General Thundery Showers" },
            relativeHumidity: { low: 60, high: 95 },
            temperature: { low: 24, high: 33 },
            wind: { speed: { low: 10, high: 25 }, direction: "SSE" },
          },
          periods: [
            {
              timePeriod: {
                start: periodStart.toISOString(),
                end: periodEnd.toISOString(),
              },
              regions: {
                north: { code: "TL", text: "North Thundery Showers" },
                south: { code: "TL", text: "South Thundery Showers" },
                east: { code: "TL", text: "East Thundery Showers" },
                west: { code: "TL", text: "West Thundery Showers" },
                central: { code: "TL", text: "Central Thundery Showers" },
              },
            },
          ],
        },
      ],
    },
  };
}

function fourDayFixture(dateTimestamp: string) {
  return {
    code: 0,
    data: {
      records: [
        {
          date: "2026-07-30",
          updatedTimestamp: "2026-07-30T11:00:52+08:00",
          forecasts: [
            {
              timestamp: dateTimestamp,
              day: "Friday",
              forecast: { code: "TL", text: "4-day Thundery Showers" },
              temperature: { low: 25, high: 34 },
              relativeHumidity: { low: 60, high: 95 },
              wind: { speed: { low: 10, high: 20 }, direction: "SE" },
            },
          ],
        },
      ],
    },
  };
}

function mockFetchByUrl(handlers: Record<string, () => unknown>) {
  return jest.fn((input: string | URL) => {
    const url = input.toString();
    for (const [match, getBody] of Object.entries(handlers)) {
      if (url.includes(match)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(getBody()),
        } as Response);
      }
    }
    throw new Error(`Unexpected fetch call: ${url}`);
  });
}

describe("getForecastForSlot", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the 2hr nowcast, matched to the nearest area by coordinates, when the slot starts within 90 minutes", async () => {
    globalThis.fetch = mockFetchByUrl({
      "two-hr-forecast": () => TWO_HR_FIXTURE,
    }) as unknown as typeof fetch;

    const slotStartTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    // Coordinates close to Bedok's label_location, not Ang Mo Kio's.
    const result = await getForecastForSlot("east", 1.322, 103.925, slotStartTime);

    expect(result).toEqual({ forecast: "Light Rain", source: "2hr" });
  });

  it("uses the 24hr forecast, matched by time period and region, when the slot is later today", async () => {
    const periodStart = new Date(Date.now() + 60 * 60 * 1000);
    const periodEnd = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const slotStartTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    globalThis.fetch = mockFetchByUrl({
      "twenty-four-hr-forecast": () => twentyFourHrFixture(periodStart, periodEnd),
    }) as unknown as typeof fetch;

    const result = await getForecastForSlot("east", 1.3, 103.8, slotStartTime);

    expect(result).toEqual({ forecast: "East Thundery Showers", source: "24hr" });
  });

  it("uses the 4-day outlook, matched by date, when the slot is more than a day out", async () => {
    const slotDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const slotStartTime = slotDate.toISOString();

    globalThis.fetch = mockFetchByUrl({
      "four-day-outlook": () => fourDayFixture(slotStartTime),
    }) as unknown as typeof fetch;

    const result = await getForecastForSlot("east", 1.3, 103.8, slotStartTime);

    expect(result).toEqual({ forecast: "4-day Thundery Showers", source: "4day" });
  });

  it("returns unavailable without calling any API when the slot is more than 4 days out", async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const slotStartTime = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = await getForecastForSlot("east", 1.3, 103.8, slotStartTime);

    expect(result).toEqual({
      forecast: "Forecast not yet available",
      source: "unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls through to the 24hr tier when the 2hr area has no matching forecast entry", async () => {
    const periodStart = new Date(Date.now() - 60 * 60 * 1000);
    const periodEnd = new Date(Date.now() + 60 * 60 * 1000);
    const slotStartTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    globalThis.fetch = mockFetchByUrl({
      "two-hr-forecast": () => ({
        code: 0,
        data: {
          // area_metadata has no areas at all, so findNearestArea returns null
          // and the 2hr forecast lookup can never succeed.
          area_metadata: [],
          items: [
            {
              timestamp: "2026-07-30T11:10:00+08:00",
              valid_period: {
                start: "2026-07-30T11:00:00+08:00",
                end: "2026-07-30T13:00:00+08:00",
              },
              forecasts: [],
            },
          ],
        },
      }),
      "twenty-four-hr-forecast": () => twentyFourHrFixture(periodStart, periodEnd),
    }) as unknown as typeof fetch;

    const result = await getForecastForSlot("west", 1.3, 103.8, slotStartTime);

    expect(result).toEqual({ forecast: "West Thundery Showers", source: "24hr" });
  });
});
