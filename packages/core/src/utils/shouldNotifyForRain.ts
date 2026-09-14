const RAIN_KEYWORDS = ["rain", "shower", "thunder", "drizzle"];

/**
 * Whether an NEA forecast string warrants a "bring an umbrella" nudge.
 * Deliberately keyword-based rather than tied to `source` — the placeholder
 * strings for missing forecasts ("Forecast not yet available", "Forecast
 * unavailable", "Couldn't load forecast") naturally contain none of these
 * words, so no separate check against `source` is needed.
 */
export function shouldNotifyForRain(forecastText: string): boolean {
  const text = forecastText.toLowerCase();
  return RAIN_KEYWORDS.some((keyword) => text.includes(keyword));
}
