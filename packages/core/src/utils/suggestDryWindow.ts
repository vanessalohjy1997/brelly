import type { UpcomingPeriodForecast } from "@/services/weather";

const RAIN_KEYWORDS = ["rain", "shower", "thunder", "drizzle"];

function isWet(forecast: string): boolean {
  const text = forecast.toLowerCase();
  return RAIN_KEYWORDS.some((k) => text.includes(k));
}

export type DryWindowSuggestion = {
  currentPeriod: UpcomingPeriodForecast;
  suggestedPeriod: UpcomingPeriodForecast;
};

/**
 * When a slot's forecast period is wet and an adjacent one isn't, returns the
 * dry window. Checks both the next and previous periods, preferring the next
 * (people more readily shift forward).
 */
export function suggestDryWindow(
  slotStart: string,
  periods: UpcomingPeriodForecast[],
): DryWindowSuggestion | null {
  if (periods.length < 2) return null;

  const slotTime = new Date(slotStart).getTime();
  const idx = periods.findIndex((p) => {
    const start = new Date(p.start).getTime();
    const end = new Date(p.end).getTime();
    return slotTime >= start && slotTime < end;
  });

  if (idx === -1) return null;

  const current = periods[idx];
  if (!isWet(current.forecast)) return null;

  const next = periods[idx + 1];
  if (next && !isWet(next.forecast)) {
    return { currentPeriod: current, suggestedPeriod: next };
  }

  const prev = periods[idx - 1];
  if (prev && !isWet(prev.forecast)) {
    return { currentPeriod: current, suggestedPeriod: prev };
  }

  return null;
}
