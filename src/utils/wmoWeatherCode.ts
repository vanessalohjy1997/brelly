// Open-Meteo reports condition as a numeric WMO weather code (0-99), not
// English text. Translated here to strings that deliberately reuse NEA's own
// forecast vocabulary ("Light Rain", "Fair (Day)", "Thundery Showers", ...)
// so every existing keyword-matcher (`forecastToSymbol`, `shouldNotifyForRain`,
// `derivePackingList`, `describeUmbrella`'s rain branch) keeps working for
// Open-Meteo forecasts with no changes of its own — see the WMO code table at
// https://open-meteo.com/en/docs.
//
// Snow/sleet codes (71-77, 85-86) are out of scope for v1 — the prioritized
// overseas markets are all tropical — and fall back to a plain "Cloudy",
// same as any other unrecognised code.

const THUNDER_CODES = new Set([95, 96, 99]);
const HEAVY_SHOWER_CODES = new Set([82]);
const SHOWER_CODES = new Set([80, 81]);
const HEAVY_RAIN_CODES = new Set([65, 66, 67]);
const MODERATE_RAIN_CODES = new Set([63]);
// Drizzle is light rain in substance, and translated to "Light Rain" text
// (not "Drizzle") so it also matches `forecastToSymbol`'s "rain"/"shower"
// check, not just `shouldNotifyForRain`'s separate "drizzle" keyword.
const LIGHT_RAIN_CODES = new Set([51, 53, 55, 56, 57, 61]);
const FOG_CODES = new Set([45, 48]);
const OVERCAST_CODES = new Set([3]);
const PARTLY_CLOUDY_CODES = new Set([2]);
const CLEAR_CODES = new Set([0, 1]);

export function wmoCodeToForecastText(
  code: number,
  isDaytime: boolean,
): string {
  const dayNight = isDaytime ? "Day" : "Night";

  if (THUNDER_CODES.has(code)) return "Thundery Showers";
  if (HEAVY_SHOWER_CODES.has(code)) return "Heavy Showers";
  if (SHOWER_CODES.has(code)) return "Passing Showers";
  if (HEAVY_RAIN_CODES.has(code)) return "Heavy Rain";
  if (MODERATE_RAIN_CODES.has(code)) return "Moderate Rain";
  if (LIGHT_RAIN_CODES.has(code)) return "Light Rain";
  if (FOG_CODES.has(code)) return "Hazy";
  if (OVERCAST_CODES.has(code)) return "Cloudy";
  if (PARTLY_CLOUDY_CODES.has(code)) return `Partly Cloudy (${dayNight})`;
  if (CLEAR_CODES.has(code)) return `Fair (${dayNight})`;

  // Unrecognised code (including snow, out of scope for v1) — the same
  // generic fallback `forecastToSymbol` itself uses for anything it can't
  // match.
  return `Partly Cloudy (${dayNight})`;
}

const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE",
  "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW",
  "W", "WNW", "NW", "NNW",
];

export function degreesToCompass(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[index];
}
