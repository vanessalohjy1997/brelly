export function formatTempRange(range: { low: number; high: number }): string {
  return `${Math.round(range.low)}–${Math.round(range.high)}°C`;
}
