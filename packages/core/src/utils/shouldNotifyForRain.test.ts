import { shouldNotifyForRain } from "@/utils/shouldNotifyForRain";

describe("shouldNotifyForRain", () => {
  it.each([
    "Afternoon Thundery Showers",
    "Light Rain",
    "Heavy Showers",
    "Drizzle",
    "THUNDERSTORMS", // case-insensitive
  ])("returns true for %s", (forecast) => {
    expect(shouldNotifyForRain(forecast)).toBe(true);
  });

  it.each([
    "Fair and Warm",
    "Partly Cloudy",
    "Hazy",
    "Windy",
    "Forecast not yet available",
    "Forecast unavailable",
    "Couldn't load forecast",
  ])("returns false for %s", (forecast) => {
    expect(shouldNotifyForRain(forecast)).toBe(false);
  });
});
