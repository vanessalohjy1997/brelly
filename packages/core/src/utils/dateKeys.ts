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

/**
 * Parses a "YYYY-MM-DD" key back into a *local* date, at midnight.
 *
 * `new Date("2026-08-01")` is not this: the string form is parsed as UTC
 * midnight, so west of Greenwich it formats as the previous day. The
 * component form is local by definition — the same reason `toDateKey` exists.
 */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * The key `days` calendar days after `key` — negative to go back.
 *
 * Day arithmetic goes through `Date` rather than the string, so month ends,
 * leap years and DST shifts are the platform's problem rather than ours.
 */
export function shiftDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
