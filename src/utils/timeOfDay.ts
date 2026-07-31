export type TimeOfDay = { hours: number; minutes: number };

/** Parses "HH:MM" (24-hour). Returns null for anything malformed. */
export function parseTimeOfDay(value: string): TimeOfDay | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return { hours, minutes };
}

/** Minutes since local midnight, for comparing times of day. */
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Whether `date` falls inside the quiet window.
 *
 * The window wraps midnight whenever `end` is earlier than `start` — the
 * default 22:00–07:00 spans two calendar days, so a plain `start <= t < end`
 * comparison would match nothing at all.
 *
 * `start === end` is treated as an empty window, not a 24-hour one: a user
 * who lands on it by dragging two pickers together almost certainly means
 * "no quiet hours" rather than "silence everything forever".
 */
export function isWithinQuietHours(
  date: Date,
  start: string,
  end: string,
): boolean {
  const from = parseTimeOfDay(start);
  const to = parseTimeOfDay(end);
  if (!from || !to) return false;

  const current = minutesSinceMidnight(date);
  const fromMinutes = from.hours * 60 + from.minutes;
  const toMinutes = to.hours * 60 + to.minutes;

  if (fromMinutes === toMinutes) return false;

  return fromMinutes < toMinutes
    ? current >= fromMinutes && current < toMinutes
    : current >= fromMinutes || current < toMinutes;
}

/**
 * The next moment matching `time` ("HH:MM") strictly after `now` — today if
 * that hasn't passed yet, otherwise tomorrow. Returns null for a malformed
 * time. Used to place the daily digest, whose body has to be composed for a
 * specific day rather than left to a repeating trigger.
 */
export function nextOccurrenceOfTime(time: string, now: Date): Date | null {
  const parsed = parseTimeOfDay(time);
  if (!parsed) return null;

  const next = new Date(now);
  next.setHours(parsed.hours, parsed.minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}
