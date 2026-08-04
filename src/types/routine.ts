import type { SlotKind } from "@/utils/slotKind";

/**
 * A standing commitment — "office, Monday to Friday, 9 to 6".
 *
 * The rule is stored; the *stops* are not. A routine is materialised into
 * ordinary `ItinerarySlot`s a fortnight at a time and topped up on launch, so
 * everything downstream — `splitPlansByTime`, the notification resync,
 * `filterPlans`, the archive — keeps walking concrete slots and knows nothing
 * about recurrence. See `planRoutineMaterialization` for why that split is
 * where it is.
 */
export type Routine = {
  id: string;
  label: string;
  location: string; // human-readable display name
  latitude: number;
  longitude: number;
  /**
   * Which days it falls on, as `Date.getDay()` — 0 is Sunday, 6 is Saturday.
   *
   * An array rather than a bitmask so the persisted JSON is readable, and
   * because the form works in terms of "which chips are on" anyway.
   */
  weekdays: number[];
  /**
   * Times of day, `"HH:MM"` 24-hour — the same shape `QuietHours` and
   * `DigestSettings` use in the settings store.
   *
   * Not ISO instants: a routine has no single date, and an instant would carry
   * one in. An `endTime` at or before `startTime` reads as running past
   * midnight, which is the rule `applyEndTime` already applies on the form.
   */
  startTime: string;
  endTime: string;
  /** First day the routine can produce a stop. */
  startDate: string; // YYYY-MM-DD
  /** Last day it can. Absent means it runs indefinitely. */
  endDate?: string; // YYYY-MM-DD
  kind?: SlotKind;
  notificationsMuted?: boolean;
  /**
   * Days this routine must never fill in.
   *
   * Written when a stop is deleted or detached with "this day only". Without
   * it the next top-up would read the gap as "not materialised yet" and put
   * the stop straight back — an undo the user never asked for.
   */
  exceptions: string[]; // YYYY-MM-DD
};

/** The part of a routine the add-plan form collects. */
export type RepeatRule = {
  weekdays: number[];
  endDate?: string; // YYYY-MM-DD; absent = ongoing
};
