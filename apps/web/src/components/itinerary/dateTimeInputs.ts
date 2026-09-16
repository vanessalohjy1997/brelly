/**
 * `<input type="date">` and `<input type="time">` speak **local wall-clock
 * strings**, not instants: `"2026-09-15"` and `"14:30"`. Everything else in the
 * app works in ISO instants. These four functions are that boundary, and they
 * are here rather than inline because getting the direction wrong is silent —
 * `toISOString().slice(0, 10)` formats in UTC, so in Singapore every stop
 * between midnight and 08:00 would render as the previous day.
 *
 * This is the same trap `toDateKey` exists for in core; the difference is that
 * these also have to go the other way, back from what the input reports.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** A `Date` as the `YYYY-MM-DD` an `<input type="date">` wants, in local time. */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A `Date` as the `HH:MM` an `<input type="time">` wants, in local time. */
export function toTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The day an `<input type="date">` reports, as a `Date` at local midnight.
 *
 * Built field by field rather than with `new Date("2026-09-15")`, which the
 * spec says to parse as **UTC** midnight — a date-only string is the one form
 * `Date` treats that way, and it is how a day picked in Singapore becomes the
 * day before.
 *
 * Returns `null` for the empty value a cleared input reports, which callers
 * read as "no change" rather than as a date at the epoch.
 */
export function fromDateInputValue(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/**
 * The time an `<input type="time">` reports, applied to `onDate`'s day.
 *
 * Takes the day rather than returning a bare time because every caller is about
 * to combine the two anyway, and doing it here keeps the "which day does this
 * time belong to" question in one place.
 */
export function fromTimeInputValue(value: string, onDate: Date): Date | null {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const result = new Date(onDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
