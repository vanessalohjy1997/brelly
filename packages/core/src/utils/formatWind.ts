/**
 * Real-time wind-speed stations report in knots, not km/h — a different unit
 * from the forecast endpoints, which is exactly the kind of mismatch that
 * silently renders a wrong number.
 *
 * The forecast-side formatter that used to live here is gone: wind never fed
 * the umbrella verdict, and it was dropped from the stop card.
 */
export function formatWindSpeedKnots(knots: number | undefined): string | null {
  if (knots === undefined) return null;
  return `${Math.round(knots * 1.852)} km/h`;
}
