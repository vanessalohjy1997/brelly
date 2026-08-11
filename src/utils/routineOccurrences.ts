import type { ItinerarySlot } from "@/types/itinerary";
import type { Routine } from "@/types/routine";
import { parseDateKey, shiftDays } from "@/utils/dateKeys";

/**
 * How far ahead a routine is filled in.
 *
 * Far enough to plan around, short enough that a weekday routine doesn't bury
 * one-off plans under a hundred identical rows in a list whose whole design is
 * "what's ahead". The window rolls: every launch tops it back up, so a routine
 * never runs out the way a fixed-count repeat does.
 */
export const RoutineHorizonDays = 14;

/** The slot shape `addSlot` takes — id and region are derived there. */
export type RoutineSlotInput = Omit<
  ItinerarySlot,
  "id" | "neaRegion" | "notificationId"
>;

/**
 * The deterministic id a routine's stop on a given day is filed under.
 *
 * Both devices sharing a uid compute the same id for the same
 * (routine, date) pair, so a second device's materialisation pass is an
 * idempotent overwrite of the first's rather than a duplicate — see
 * FIREBASE_MIGRATION.md's `useRoutineMaterializer.ts` section. Detaching a
 * stop with "this day only" must re-key it to an ordinary id, or a later
 * exception-lift would let this function recompute the same id and overwrite
 * the detached stop the user deliberately kept.
 */
export function materializedSlotId(routineId: string, date: string): string {
  return `r_${routineId}_${date}`;
}

/** `"HH:MM"` → `{ hours, minutes }`. */
function parseTimeOfDay(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours, minutes };
}

/** `"HH:MM"` for a date, in the device's timezone. */
export function toTimeOfDay(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function isBetween(date: string, from: string, to: string | undefined) {
  // Date keys are "YYYY-MM-DD", which compare lexically the same as
  // chronologically — the same property `splitPlansByTime` relies on.
  return date >= from && (to === undefined || date <= to);
}

/**
 * The days a routine falls on inside `[from, from + days]`, in order.
 *
 * Bounded by the routine's own `startDate`/`endDate` as well as the window, and
 * with `exceptions` removed — a day the user deleted stays deleted, which is
 * the whole reason exceptions are stored rather than inferred from a gap.
 */
export function routineOccurrenceDates(
  routine: Routine,
  from: string,
  days: number,
): string[] {
  const dates: string[] = [];

  for (let offset = 0; offset <= days; offset += 1) {
    const date = shiftDays(from, offset);
    if (!isBetween(date, routine.startDate, routine.endDate)) continue;
    if (!routine.weekdays.includes(parseDateKey(date).getDay())) continue;
    if (routine.exceptions.includes(date)) continue;
    dates.push(date);
  }

  return dates;
}

/**
 * The stop a routine produces on one day.
 *
 * Times are rebuilt from the local calendar day rather than shifted off some
 * reference instant, so a routine spanning a DST change still starts at 09:00
 * on both sides of it. An end at or before the start runs to the next day —
 * the same reading `applyEndTime` gives on the form, so "23:00–00:30" means
 * what it looks like in both places.
 */
export function routineSlotForDate(
  routine: Routine,
  date: string,
): RoutineSlotInput {
  const day = parseDateKey(date);
  const startAt = parseTimeOfDay(routine.startTime);
  const endAt = parseTimeOfDay(routine.endTime);

  const start = new Date(day);
  start.setHours(startAt.hours, startAt.minutes, 0, 0);

  const end = new Date(day);
  end.setHours(endAt.hours, endAt.minutes, 0, 0);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);

  return {
    label: routine.label,
    location: routine.location,
    latitude: routine.latitude,
    longitude: routine.longitude,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    kind: routine.kind,
    notificationsMuted: routine.notificationsMuted,
    routineId: routine.id,
  };
}

/**
 * The routine fields an existing stop disagrees with.
 *
 * Used by the edit screen's "this and future days" branch, which has to turn a
 * changed slot back into a changed rule. The *day* is deliberately not derived
 * here: a routine has no single date, so moving one stop to another day can
 * only ever mean "this day only".
 */
export function routineUpdatesFromSlot(
  slot: Pick<
    ItinerarySlot,
    | "label"
    | "location"
    | "latitude"
    | "longitude"
    | "startTime"
    | "endTime"
    | "kind"
    | "notificationsMuted"
  >,
): Partial<Omit<Routine, "id" | "exceptions">> {
  return {
    label: slot.label,
    location: slot.location,
    latitude: slot.latitude,
    longitude: slot.longitude,
    startTime: toTimeOfDay(new Date(slot.startTime)),
    endTime: toTimeOfDay(new Date(slot.endTime)),
    kind: slot.kind,
    notificationsMuted: slot.notificationsMuted,
  };
}
