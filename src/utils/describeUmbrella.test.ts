import { describeUmbrella } from "@/utils/describeUmbrella";

// Real NEA forecast strings — the 2hr nowcast and 24hr/4day tiers word these
// differently, and the verdict has to read all of them.
const RAINY = "Thundery Showers";
const PASSING = "Passing Showers";
const FAIR = "Fair (Day)";
const CLOUDY = "Partly Cloudy (Day)";

describe("describeUmbrella", () => {
  it("calls rain when the forecast is wet and UV is low", () => {
    expect(describeUmbrella(RAINY, 3)).toEqual({
      reason: "rain",
      needed: true,
      label: "Umbrella — rain",
      shortLabel: "Rain",
      themeColor: "umbrellaRain",
    });
  });

  it("calls sun when it's dry but UV is very high", () => {
    expect(describeUmbrella(FAIR, 9)).toEqual({
      reason: "sun",
      needed: true,
      label: "Umbrella — sun",
      shortLabel: "Sun",
      themeColor: "umbrellaSun",
    });
  });

  it("names both triggers when both fire", () => {
    expect(describeUmbrella(PASSING, 10)).toMatchObject({
      reason: "both",
      needed: true,
      label: "Umbrella — rain and sun",
      shortLabel: "Rain + sun",
    });
  });

  it("carries a pill-length form of every verdict, not just the sentence", () => {
    expect(describeUmbrella(RAINY, 3).shortLabel).toBe("Rain");
    expect(describeUmbrella(FAIR, 9).shortLabel).toBe("Sun");
    expect(describeUmbrella(PASSING, 10).shortLabel).toBe("Rain + sun");
    expect(describeUmbrella(CLOUDY, 4).shortLabel).toBe("Clear");
  });

  it("tints for rain when both fire — rain is the one with a cost attached", () => {
    expect(describeUmbrella(PASSING, 10).themeColor).toBe("umbrellaRain");
  });

  it("is clear when neither fires", () => {
    expect(describeUmbrella(CLOUDY, 4)).toEqual({
      reason: "none",
      needed: false,
      label: "You're clear",
      shortLabel: "Clear",
      themeColor: null,
    });
  });

  it("gives 'clear' no tint, so a tint always means something", () => {
    expect(describeUmbrella(FAIR, 0).themeColor).toBeNull();
  });

  it("does not trigger sun at UV 7, which Singapore reaches most clear days", () => {
    expect(describeUmbrella(FAIR, 7).needed).toBe(false);
  });

  it("triggers sun from UV 8", () => {
    expect(describeUmbrella(FAIR, 8).reason).toBe("sun");
  });

  it("falls back to rain-only when there's no UV reading", () => {
    expect(describeUmbrella(RAINY, null).reason).toBe("rain");
    expect(describeUmbrella(FAIR, undefined).reason).toBe("none");
  });

  it("falls back to UV-only when there's no forecast", () => {
    expect(describeUmbrella(undefined, 9).reason).toBe("sun");
    expect(describeUmbrella(undefined, undefined).reason).toBe("none");
  });

  it("reads a missing-forecast placeholder as dry, not as rain", () => {
    // These strings stand in for an absent forecast and contain none of the
    // rain keywords — the verdict must not invent a warning from them.
    expect(describeUmbrella("Forecast not yet available", 2).needed).toBe(false);
    expect(describeUmbrella("Couldn't load forecast", 2).needed).toBe(false);
  });

  it.each(["Light Rain", "Heavy Thundery Showers", "Slight Drizzle"])(
    "reads %s as rain",
    (forecast) => {
      expect(describeUmbrella(forecast, 1).reason).toBe("rain");
    },
  );
});
