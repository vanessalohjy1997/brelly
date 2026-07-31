import type { NeaWind } from "@/types/weather";

/**
 * "SSE 10–20 km/h" — NEA reports forecast wind as a km/h range plus a compass
 * abbreviation. Collapses to a single figure when low and high are equal,
 * rather than rendering "10–10".
 */
export function formatWind(wind: NeaWind | undefined): string | null {
  if (!wind) return null;

  const { low, high } = wind.speed;
  const speed =
    Math.round(low) === Math.round(high)
      ? `${Math.round(low)}`
      : `${Math.round(low)}–${Math.round(high)}`;

  return wind.direction
    ? `${wind.direction} ${speed} km/h`
    : `${speed} km/h`;
}

/**
 * Real-time wind-speed stations report in knots, not km/h — a different unit
 * from the forecast endpoints, which is exactly the kind of mismatch that
 * silently renders a wrong number.
 */
export function formatWindSpeedKnots(knots: number | undefined): string | null {
  if (knots === undefined) return null;
  return `${Math.round(knots * 1.852)} km/h`;
}
