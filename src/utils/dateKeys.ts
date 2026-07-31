/**
 * `YYYY-MM-DD` for a date in the *device's* timezone.
 *
 * `date.toISOString().split("T")[0]` looks equivalent and isn't: it formats in
 * UTC, so anywhere east of Greenwich the key flips to the previous day for the
 * first hours after local midnight — in Singapore (UTC+8) that's every day
 * from 00:00 to 08:00, during which "today" would resolve to yesterday's plans.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` for today, in the device's timezone. */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}
