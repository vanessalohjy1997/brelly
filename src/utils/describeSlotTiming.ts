const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Past this far ahead, a countdown stops being an answer. "in 14 hr" is not
 * something anyone plans against — the clock time is, and the day heading
 * above the card has already said which day.
 */
const RELATIVE_HORIZON = 12 * HOUR;

export type SlotTiming = {
  /**
   * "Now", "in 40 min", "in 3 hr" — or null when the absolute time says it
   * better, which is every stop further out than `RELATIVE_HORIZON` and every
   * stop already over.
   */
  relative: string | null;
  /** The stop is happening right now. */
  isNow: boolean;
};

/**
 * How a stop sits against the clock, for the line at the top of its card.
 *
 * "02:00 PM – 03:00 PM" answers *when* and leaves *how soon* to the reader,
 * which on the Today screen is the only question being asked. This puts the
 * countdown first and keeps the absolute times behind it, so the card reads
 * "in 40 min" at a glance and still says which 40 minutes.
 *
 * Takes `now` as an argument rather than reading the clock, so the wording is
 * testable without freezing time — the same reason `formatPlanDate` does.
 */
export function describeSlotTiming(
  startTime: string,
  endTime: string,
  now: Date,
): SlotTiming {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  // A slot the app can't place on a clock gets the plain absolute line rather
  // than a confident lie about it — `new Date("nonsense").getTime()` is NaN,
  // and every comparison below would quietly be false.
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { relative: null, isNow: false };
  }

  const time = now.getTime();
  if (time >= end) return { relative: null, isNow: false };
  // `>=` on the start and `<` on the end, matching `findCurrentOrNextSlot` and
  // `splitPlansByTime` — a stop is current from the minute it starts until the
  // minute it ends, and the three have to agree or the highlighted card and
  // the anchored live readings drift apart.
  if (time >= start) return { relative: "Now", isNow: true };

  const until = start - time;
  if (until >= RELATIVE_HORIZON) return { relative: null, isNow: false };
  if (until < MINUTE) return { relative: "in under a minute", isNow: false };
  if (until < HOUR) {
    return { relative: `in ${Math.floor(until / MINUTE)} min`, isNow: false };
  }

  // Rounded down, so "in 2 hr" never arrives before two hours have passed —
  // the direction that can't make someone late.
  const hours = Math.floor(until / HOUR);
  return { relative: `in ${hours} hr`, isNow: false };
}
