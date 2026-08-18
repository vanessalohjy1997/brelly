import {
  degreesToCompass,
  wmoCodeToForecastText,
} from "@/utils/wmoWeatherCode";

describe("wmoCodeToForecastText", () => {
  it("maps clear sky to Fair, day and night", () => {
    expect(wmoCodeToForecastText(0, true)).toBe("Fair (Day)");
    expect(wmoCodeToForecastText(0, false)).toBe("Fair (Night)");
    expect(wmoCodeToForecastText(1, true)).toBe("Fair (Day)");
  });

  it("maps partly cloudy, day and night", () => {
    expect(wmoCodeToForecastText(2, true)).toBe("Partly Cloudy (Day)");
    expect(wmoCodeToForecastText(2, false)).toBe("Partly Cloudy (Night)");
  });

  it("maps overcast to a plain Cloudy, with no partly/cloudy ambiguity", () => {
    const text = wmoCodeToForecastText(3, true);
    expect(text).toBe("Cloudy");
    expect(text.toLowerCase()).not.toContain("partly");
  });

  it("maps fog codes to text containing a haze/fog keyword", () => {
    for (const code of [45, 48]) {
      expect(wmoCodeToForecastText(code, true).toLowerCase()).toMatch(
        /hazy|mist|fog/,
      );
    }
  });

  it("maps drizzle and slight rain to text containing 'rain', for shouldNotifyForRain/forecastToSymbol", () => {
    for (const code of [51, 53, 55, 56, 57, 61]) {
      expect(wmoCodeToForecastText(code, true).toLowerCase()).toContain("rain");
    }
  });

  it("maps moderate and heavy rain to text containing 'rain'", () => {
    for (const code of [63, 65, 66, 67]) {
      expect(wmoCodeToForecastText(code, true).toLowerCase()).toContain("rain");
    }
  });

  it("maps rain showers to text containing 'shower', for forecastToSymbol's rain branch", () => {
    for (const code of [80, 81, 82]) {
      expect(wmoCodeToForecastText(code, true).toLowerCase()).toContain(
        "shower",
      );
    }
  });

  it("maps thunderstorm codes to text containing 'thunder'", () => {
    for (const code of [95, 96, 99]) {
      expect(wmoCodeToForecastText(code, true).toLowerCase()).toContain(
        "thunder",
      );
    }
  });

  it("falls back to a generic partly-cloudy reading for unrecognised codes, including snow", () => {
    for (const code of [71, 73, 75, 77, 85, 86, 42]) {
      expect(wmoCodeToForecastText(code, true)).toBe("Partly Cloudy (Day)");
      expect(wmoCodeToForecastText(code, false)).toBe("Partly Cloudy (Night)");
    }
  });
});

describe("degreesToCompass", () => {
  it("maps 0 degrees to N", () => {
    expect(degreesToCompass(0)).toBe("N");
  });

  it("maps 359 degrees back to N", () => {
    expect(degreesToCompass(359)).toBe("N");
  });

  it("maps each 22.5 degree octant boundary to the expected point", () => {
    expect(degreesToCompass(90)).toBe("E");
    expect(degreesToCompass(180)).toBe("S");
    expect(degreesToCompass(270)).toBe("W");
    expect(degreesToCompass(157.5)).toBe("SSE");
  });
});
