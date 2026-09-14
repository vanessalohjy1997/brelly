import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { toDateKey } from "@/utils/dateKeys";

/**
 * A stop, expressed the way a calendar wants it.
 *
 * `notes` carries the attribution rather than a `url` or a custom property:
 * every calendar app on both platforms shows notes, and nothing else is
 * guaranteed to survive a sync round-trip through a CalDAV server.
 */
export type CalendarEventDraft = {
  title: string;
  startDate: Date;
  endDate: Date;
  location: string;
  notes: string;
};

/** An event from the device calendar, reduced to what a stop needs. */
export type ImportableEvent = {
  id: string;
  title: string;
  location: string;
  startDate: Date;
  endDate: Date;
};

export type RawCalendarEvent = {
  id: string;
  title?: string | null;
  location?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  allDay?: boolean | null;
};

export function slotToCalendarEvent(slot: ItinerarySlot): CalendarEventDraft {
  return {
    title: slot.label,
    startDate: new Date(slot.startTime),
    endDate: new Date(slot.endTime),
    location: slot.location,
    notes: "Added by Brelly.",
  };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The events worth offering to import, from whatever the device handed back.
 *
 * Three things are dropped, each for its own reason:
 *
 * - **All-day events.** A stop is a window on a clock — the forecast tier is
 *   chosen from its start time, and "all of Tuesday" has no start time to
 *   choose from. Importing one would produce a stop at midnight.
 * - **Events with no location.** Brelly's entire job is the weather *there*;
 *   an event with nowhere attached can't be given a forecast, and a stop
 *   without coordinates is a card that permanently says "No forecast".
 * - **Events that have already finished.** They would import straight into the
 *   archive, which is not what anyone means by "import my calendar".
 */
export function toImportableEvents(
  events: RawCalendarEvent[],
  now: Date,
): ImportableEvent[] {
  const importable: ImportableEvent[] = [];

  for (const event of events) {
    if (event.allDay) continue;

    const title = event.title?.trim();
    const location = event.location?.trim();
    if (!title || !location) continue;

    const startDate = toDate(event.startDate);
    const endDate = toDate(event.endDate);
    if (!startDate || !endDate) continue;
    if (endDate.getTime() <= now.getTime()) continue;

    importable.push({ id: event.id, title, location, startDate, endDate });
  }

  return importable.sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );
}

/**
 * Whether this event is already on the itinerary.
 *
 * Matched on label plus start time rather than on any stored calendar id.
 * Importing twice is the normal case — the feature invites you to run it again
 * next week — and an id would only catch the copies this app made, not the
 * ones the user typed in by hand after seeing the same event.
 */
export function isAlreadyPlanned(
  plans: DayPlan[],
  event: ImportableEvent,
): boolean {
  const dayKey = toDateKey(event.startDate);
  const plan = plans.find((p) => p.date === dayKey);
  if (!plan) return false;

  return plan.slots.some(
    (slot) =>
      slot.label.trim().toLowerCase() === event.title.toLowerCase() &&
      new Date(slot.startTime).getTime() === event.startDate.getTime(),
  );
}

export type ImportOutcome = {
  imported: number;
  /** Already on the itinerary — not an error, and not worth alarming about. */
  duplicates: number;
  /** Location text that no place lookup could turn into coordinates. */
  unresolved: number;
};

/**
 * One sentence for the toast.
 *
 * Written out rather than assembled from fragments because the interesting
 * cases are the *empty* ones: "0 imported" after tapping Import reads as a
 * failure, when in practice it usually means everything was already there.
 */
export function summarizeImport(outcome: ImportOutcome): string {
  const { imported, duplicates, unresolved } = outcome;

  if (imported === 0 && duplicates === 0 && unresolved === 0) {
    return "No upcoming events with a location to import";
  }
  if (imported === 0 && duplicates > 0 && unresolved === 0) {
    return "Everything in your calendar is already planned";
  }

  const parts: string[] = [];
  parts.push(imported === 1 ? "Imported 1 event" : `Imported ${imported} events`);
  if (duplicates > 0) parts.push(`${duplicates} already planned`);
  if (unresolved > 0) {
    parts.push(
      unresolved === 1
        ? "1 had a location we couldn't find"
        : `${unresolved} had locations we couldn't find`,
    );
  }
  return parts.join(" · ");
}

/** One sentence for the toast after writing plans out to the calendar. */
export function summarizeExport(exported: number): string {
  if (exported === 0) return "Nothing upcoming to add to your calendar";
  return exported === 1
    ? "Added 1 plan to your calendar"
    : `Added ${exported} plans to your calendar`;
}
