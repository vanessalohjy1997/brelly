import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import type { Routine } from "@/types/routine";
import { shiftDays, todayKey } from "@/utils/dateKeys";
import { allSlotsWithDates } from "@/utils/planSelectors";
import {
  routineOccurrenceDates,
  routineSlotForDate,
  type RoutineSlotInput,
} from "@/utils/routineOccurrences";

export type MaterializeAction =
  | { type: "add"; date: string; slot: RoutineSlotInput }
  | { type: "remove"; date: string; slot: ItinerarySlot };

/** The fields a routine dictates. Anything else on a slot is bookkeeping. */
function matchesRoutine(slot: ItinerarySlot, expected: RoutineSlotInput) {
  return (
    slot.label === expected.label &&
    slot.location === expected.location &&
    slot.latitude === expected.latitude &&
    slot.longitude === expected.longitude &&
    slot.startTime === expected.startTime &&
    slot.endTime === expected.endTime &&
    slot.kind === expected.kind &&
    slot.notificationsMuted === expected.notificationsMuted
  );
}

/**
 * The writes that would bring the itinerary back in line with the routines.
 *
 * A routine is a rule, but every stop it produces is an ordinary slot, and that
 * split is the whole design. `splitPlansByTime` cuts slots at their end time,
 * the notification resync walks them one at a time, search filters them and the
 * archive keeps the ones that happened — none of which has a sensible answer
 * for a rule, because a rule describes a future and the archive is a past. So
 * the rule decides only *which slots exist*; everything downstream keeps seeing
 * concrete stops and knows nothing about recurrence.
 *
 * Pure, and returning actions rather than performing them, so the interesting
 * part — which days get filled in, which get swept, which are left alone — can
 * be tested without a store or a clock.
 *
 * Four rules hold it together:
 *
 * 1. **Nothing before today is ever touched.** Not filled in, not swept, not
 *    rewritten. Turning a routine off must not edit the record of a fortnight
 *    you actually lived through.
 * 2. **A stop that has already ended is left alone**, today's included. Adding a
 *    9am routine at 3pm shouldn't mint a stop that lands straight in the
 *    archive, and editing one shouldn't retouch this morning.
 * 3. **A slot with no `routineId` is never swept.** Detaching with "this day
 *    only" is permanent; after it, the stop is as ordinary as a hand-made one.
 * 4. **A slot that still carries a `routineId` is, by definition, unedited** —
 *    every per-day edit detaches — so when it disagrees with its rule the rule
 *    wins, and it is replaced rather than reconciled field by field.
 */
export function planRoutineMaterialization(
  routines: Routine[],
  plans: DayPlan[],
  now: Date,
  horizonDays: number,
): MaterializeAction[] {
  const from = todayKey(now);
  const until = shiftDays(from, horizonDays);
  const actions: MaterializeAction[] = [];

  // Every date each routine *should* occupy inside the window, so the sweep
  // below can ask "is this stop still wanted?" in one lookup.
  const wanted = new Map<string, Set<string>>();
  for (const routine of routines) {
    wanted.set(
      routine.id,
      new Set(routineOccurrenceDates(routine, from, horizonDays)),
    );
  }
  const byId = new Map(routines.map((routine) => [routine.id, routine]));

  const filled = new Map<string, Set<string>>();
  for (const { date, slot } of allSlotsWithDates(plans)) {
    if (!slot.routineId) continue; // Rule 3.

    const dates = filled.get(slot.routineId) ?? new Set<string>();
    dates.add(date);
    filled.set(slot.routineId, dates);

    if (date < from) continue; // Rule 1.
    if (new Date(slot.endTime).getTime() <= now.getTime()) continue; // Rule 2.
    // Past the horizon is not "unwanted", only "not filled in yet" — a routine
    // whose window was longer yesterday must not lose stops today.
    if (date > until) continue;

    const routine = byId.get(slot.routineId);
    if (!routine || !wanted.get(slot.routineId)?.has(date)) {
      // The routine is gone, the weekday was deselected, an end date was pulled
      // in, or the day was made an exception.
      actions.push({ type: "remove", date, slot });
      continue;
    }

    if (!matchesRoutine(slot, routineSlotForDate(routine, date))) {
      // Rule 4: replace, and let the caller re-add it below.
      actions.push({ type: "remove", date, slot });
      dates.delete(date);
    }
  }

  for (const routine of routines) {
    const covered = filled.get(routine.id) ?? new Set<string>();
    for (const date of wanted.get(routine.id) ?? []) {
      if (covered.has(date)) continue;
      const slot = routineSlotForDate(routine, date);
      if (new Date(slot.endTime).getTime() <= now.getTime()) continue; // Rule 2.
      actions.push({ type: "add", date, slot });
    }
  }

  return actions;
}
