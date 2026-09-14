import type { DayPlan } from "@/types/itinerary";
import { sortSlotsByStart } from "@/utils/planSelectors";

/**
 * Splits every plan into the stops still ahead and the stops already finished,
 * each kept under the day it belongs to.
 *
 * The cut is per *slot*, on end time — not per day, which is what the
 * `splitPlansByDate` this replaces did. A stop that ended at 11am is history
 * by lunchtime and shouldn't hold the top of today's list for another thirteen
 * hours, so today's plan can legitimately appear in both halves: the morning
 * in `past`, the evening in `upcoming`. A whole past day still lands entirely
 * in `past`, exactly as before.
 *
 * A day with nothing in a bucket is dropped from that bucket, so `upcoming`
 * is precisely what the Plans tab renders and `past` is precisely the archive.
 * `upcoming` runs soonest-first and `past` most-recent-first; within a day,
 * slots keep the app's one ordering (`sortSlotsByStart`) either way — the
 * archive reads as a record of how the day went, not backwards.
 */
export function splitPlansByTime(
  plans: DayPlan[],
  now: Date,
): { upcoming: DayPlan[]; past: DayPlan[] } {
  const time = now.getTime();
  const upcoming: DayPlan[] = [];
  const past: DayPlan[] = [];

  for (const plan of plans) {
    const slots = sortSlotsByStart(plan.slots);
    // `> time`, so a stop is upcoming right up to the minute it ends — you
    // are still *at* the 9–11am stop at 10:59, and the forecast for it still
    // matters. An unparseable end time gives NaN, which fails this test and
    // files the slot as past: the archive is the safe place for a slot the
    // app can't place on a clock.
    const ahead = slots.filter((s) => new Date(s.endTime).getTime() > time);
    const finished = slots.filter((s) => !(new Date(s.endTime).getTime() > time));

    if (ahead.length > 0) upcoming.push({ ...plan, slots: ahead });
    if (finished.length > 0) past.push({ ...plan, slots: finished });
  }

  // Date keys are "YYYY-MM-DD", which sort lexically the same as
  // chronologically, so no parsing is needed here.
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  past.sort((a, b) => b.date.localeCompare(a.date));

  return { upcoming, past };
}
