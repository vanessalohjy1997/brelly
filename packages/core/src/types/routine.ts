import type { RoutineFrequency } from "../utils/routineFrequency";
import type { SlotKind } from "../utils/slotKind";

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
   * ISO 3166-1 alpha-2 for the rule's location, carried so the stops it
   * materialises are no more anonymous than a hand-made one — see
   * `ItinerarySlot.countryCode`. Absent means unknown, as it does there.
   */
  countryCode?: string;
  /**
   * How often it recurs. Absent means weekly — see `resolveFrequency`, the
   * same absent-means-default trick `kind` uses. A weekly rule falls on
   * `weekdays`; a monthly one falls on `dayOfMonth`.
   */
  frequency?: RoutineFrequency;
  /**
   * Which days it falls on, as `Date.getDay()` — 0 is Sunday, 6 is Saturday.
   * Used when `frequency` is weekly; empty on a monthly rule.
   *
   * An array rather than a bitmask so the persisted JSON is readable, and
   * because the form works in terms of "which chips are on" anyway.
   */
  weekdays: number[];
  /**
   * Day of the month a monthly rule falls on, 1–31. A month with no such day —
   * the 31st in February — simply produces no stop that month: the day-by-day
   * occurrence scan never matches it, which is the standard RRULE behaviour.
   */
  dayOfMonth?: number;
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
  /** Absent means weekly — see `resolveFrequency`. */
  frequency?: RoutineFrequency;
  /** The selected weekdays, when weekly; empty when monthly. */
  weekdays: number[];
  /** Day of the month, when monthly. */
  dayOfMonth?: number;
  endDate?: string; // YYYY-MM-DD; absent = ongoing
};
