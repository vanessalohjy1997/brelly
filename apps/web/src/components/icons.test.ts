import { ICON_NAMES, Icons, iconFontHref } from "./icons";

describe("the icon registry", () => {
  it("names every icon in Material Symbols' own snake_case", () => {
    // A name that is not a ligature the font knows draws as its own text — so
    // "partly_cloudy_day" appears in the page in words, which reads as a typo
    // in the copy rather than as a missing glyph. Every name here was checked
    // against Google's `.codepoints` file for the rounded variable font.
    for (const name of Object.values(Icons)) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("de-duplicates and sorts, because the font URL is a cache key", () => {
    expect([...ICON_NAMES]).toEqual([...new Set(ICON_NAMES)].sort());
  });

  it("subsets the font to exactly the registry", () => {
    const href = iconFontHref();
    expect(href).toContain("icon_names=");
    const requested = decodeURIComponent(href.split("icon_names=")[1]).split(
      "&",
    )[0];
    expect(requested.split(",")).toEqual([...ICON_NAMES]);
  });

  it("asks for the outlined weight and blocks on the font", () => {
    // `FILL@0` is the outlined cut, which reads as a symbol rather than a blob
    // at `IconSize.metadata`. `display=block` hides the glyph until the font
    // arrives — for an icon font the fallback is the ligature text itself, so
    // swapping would flash the icon's name at the reader.
    expect(iconFontHref()).toContain("FILL,GRAD@24,400,0,0");
    expect(iconFontHref()).toContain("display=block");
  });

  it("covers the weather vocabulary forecastToSymbol maps onto", () => {
    // These eight are not decoration: they are the whole of what the forecast
    // text is turned into, so a gap here is a forecast with no icon.
    for (const key of [
      "thunder",
      "rain",
      "cloudy",
      "partlyCloudy",
      "partlyCloudyNight",
      "sunny",
      "clearNight",
      "windy",
      "hazy",
    ] as const) {
      expect(Icons[key]).toBeDefined();
    }
  });
});
