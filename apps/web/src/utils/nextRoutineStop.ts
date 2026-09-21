import { splitPlansByTime, type DayPlan, type ItinerarySlot } from "@brelly/core";

/**
 * The soonest stop a routine still has ahead of it, or `null` when the
 * materialiser has not filled one in yet.
 *
 * A routine is edited from one of its own stops — that is where "this day or
 * the rule?" can be asked with a date in hand — so the rule's row needs a stop
 * to send the reader to. The next one is the least surprising choice: it is
 * the day the reader most likely has in mind.
 */
export function nextRoutineStop(
  plans: DayPlan[],
  routineId: string,
  now: Date = new Date(),
): ItinerarySlot | null {
  const { upcoming } = splitPlansByTime(plans, now);
  const stops = upcoming
    .flatMap((plan) => plan.slots)
    .filter((slot) => slot.routineId === routineId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return stops[0] ?? null;
}
