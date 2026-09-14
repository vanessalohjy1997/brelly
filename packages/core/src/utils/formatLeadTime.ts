/**
 * How a rain-alert lead time reads in a sentence: "45 minutes", "1 hour".
 * Split out so the settings hint and the chip row can't drift apart, and so
 * the 60 → "1 hour" case is checked without rendering.
 */
export function formatLeadTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;

  const hours = minutes / 60;
  const label = hours === 1 ? "hour" : "hours";
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${label}`;
}

/** The same value compressed for a chip: "45 min", "1 hr". */
export function formatLeadTimeShort(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}
