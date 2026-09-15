import type { DayPlan, ItinerarySlot, Routine } from "@brelly/core";

/**
 * A stop shaped the way the store actually holds one — real Singapore
 * coordinates, and **ISO datetimes** for the times rather than `"09:00"`. That
 * second point is not pedantry: the emulator fixture uses wall-clock strings
 * and is unrepresentative, which is exactly why a proposal to tighten the
 * Firestore rules around slot times looked harmless and would have rejected
 * every slot write in production.
 */
export function makeSlot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "slot-1",
    label: "Lunch",
    location: "313@Somerset, 313 Orchard Rd, Singapore 238895",
    latitude: 1.3009,
    longitude: 103.8386,
    // The region these coordinates actually resolve to, checked against
    // `getRegionFromCoordinates` rather than assumed from the address.
    neaRegion: "south",
    startTime: "2026-09-15T12:00:00.000Z",
    endTime: "2026-09-15T13:00:00.000Z",
    ...overrides,
  };
}

/**
 * A weekly routine that falls on every day of the week, so one call to the
 * materialiser fills the whole horizon.
 *
 * `weekdays` is `Date.getDay()` — 0 is Sunday — and `startTime`/`endTime` are
 * `"HH:MM"` wall-clock rather than ISO instants, because a rule has no single
 * date and an instant would carry one in.
 */
export function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "routine-1",
    label: "Morning run",
    location: "East Coast Park, Singapore",
    latitude: 1.3009,
    longitude: 103.8386,
    frequency: "weekly",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startTime: "07:00",
    endTime: "08:00",
    startDate: "2020-01-01",
    exceptions: [],
    ...overrides,
  };
}

/**
 * One day's bucket. `id` is required on a `DayPlan` and is the date — the store
 * files slots into a bucket keyed by `toDateKey(startTime)`, so a fixture whose
 * `date` disagrees with its slots' start times will see the first write move
 * them somewhere else.
 */
export function makePlan(date: string, slots: ItinerarySlot[]): DayPlan {
  return { id: date, date, slots };
}
