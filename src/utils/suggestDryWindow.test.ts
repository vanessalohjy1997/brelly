import type { UpcomingPeriodForecast } from "@/services/weather";
import { suggestDryWindow } from "@/utils/suggestDryWindow";

function period(
  start: string,
  end: string,
  forecast: string,
): UpcomingPeriodForecast {
  return {
    start,
    end,
    forecast,
    temperature: { low: 25, high: 32 },
    humidity: { low: 60, high: 90 },
  };
}

describe("suggestDryWindow", () => {
  const periods = [
    period("2026-08-04T06:00", "2026-08-04T12:00", "Partly Cloudy"),
    period("2026-08-04T12:00", "2026-08-04T18:00", "Thundery Showers"),
    period("2026-08-04T18:00", "2026-08-05T06:00", "Fair"),
  ];

  it("suggests moving to a dry period when current is wet", () => {
    const result = suggestDryWindow("2026-08-04T14:00", periods);
    expect(result).not.toBeNull();
    expect(result!.currentPeriod.forecast).toBe("Thundery Showers");
    expect(result!.suggestedPeriod.forecast).toBe("Fair");
  });

  it("returns null when current period is dry", () => {
    expect(suggestDryWindow("2026-08-04T08:00", periods)).toBeNull();
  });

  it("returns null when all periods are wet", () => {
    const allWet = [
      period("2026-08-04T06:00", "2026-08-04T12:00", "Light Rain"),
      period("2026-08-04T12:00", "2026-08-04T18:00", "Showers"),
    ];
    expect(suggestDryWindow("2026-08-04T08:00", allWet)).toBeNull();
  });

  it("returns null for fewer than 2 periods", () => {
    expect(suggestDryWindow("2026-08-04T08:00", [periods[0]])).toBeNull();
    expect(suggestDryWindow("2026-08-04T08:00", [])).toBeNull();
  });

  it("returns null when slot time doesn't fall in any period", () => {
    expect(suggestDryWindow("2026-08-05T12:00", periods)).toBeNull();
  });

  it("prefers the next dry period over the previous one", () => {
    const mixed = [
      period("2026-08-04T06:00", "2026-08-04T12:00", "Fair"),
      period("2026-08-04T12:00", "2026-08-04T18:00", "Thundery Showers"),
      period("2026-08-04T18:00", "2026-08-05T06:00", "Partly Cloudy"),
    ];
    const result = suggestDryWindow("2026-08-04T14:00", mixed);
    expect(result!.suggestedPeriod.forecast).toBe("Partly Cloudy");
  });
});
