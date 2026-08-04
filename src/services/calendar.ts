import * as Calendar from "expo-calendar";

import { getPlaceDetails, searchPlaces } from "@/services/geocoding";
import type { ItinerarySlot } from "@/types/itinerary";
import {
  slotToCalendarEvent,
  toImportableEvents,
  type ImportableEvent,
} from "@/utils/calendarSync";

/** How far ahead an import looks. */
export const IMPORT_HORIZON_DAYS = 14;

export type CalendarAccessResult = { granted: boolean };

async function ensureCalendarPermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissions();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Calendar.requestCalendarPermissions();
  return requested.granted;
}

/**
 * A calendar we're allowed to write to.
 *
 * `getDefaultCalendarSync` is iOS-only — Android has no single system default,
 * because a device can carry several accounts each with their own. Falling back
 * to the first writable one there is what the Expo docs suggest, and it is the
 * one the system calendar app writes to as well.
 */
async function findWritableCalendar(): Promise<Calendar.ExpoCalendar | null> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars.find((calendar) => calendar.allowsModifications) ?? null;
}

/**
 * Writes upcoming stops out as calendar events.
 *
 * One-directional and one-shot: this copies, it does not sync. A stop edited
 * afterwards leaves a stale event behind, which is the honest trade for not
 * holding a second copy of every plan's identity and reconciling it forever —
 * and it matches what "export" means everywhere else.
 *
 * Returns the number written, or null when there is no calendar to write to,
 * so the caller can tell "nothing to export" from "couldn't export".
 */
export async function exportSlotsToCalendar(
  slots: ItinerarySlot[],
): Promise<number | null> {
  if (slots.length === 0) return 0;

  const granted = await ensureCalendarPermission();
  if (!granted) return null;

  const calendar = await findWritableCalendar();
  if (!calendar) return null;

  let written = 0;
  for (const slot of slots) {
    try {
      await calendar.createEvent(slotToCalendarEvent(slot));
      written += 1;
    } catch {
      // One rejected event — a calendar that has gone read-only mid-run, a
      // provider that dislikes a title — shouldn't abandon the rest. The
      // count the caller reports is of what actually landed.
    }
  }
  return written;
}

/**
 * Everything in the device's calendars over the next fortnight that could
 * become a stop.
 *
 * Returns null when permission was refused, so the caller can say so rather
 * than reporting an empty calendar.
 */
export async function readImportableEvents(
  now: Date = new Date(),
): Promise<ImportableEvent[] | null> {
  const granted = await ensureCalendarPermission();
  if (!granted) return null;

  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  if (calendars.length === 0) return [];

  const until = new Date(now);
  until.setDate(until.getDate() + IMPORT_HORIZON_DAYS);

  const events = await Calendar.listEvents(calendars, now, until);
  return toImportableEvents(
    events.map((event) => ({
      id: event.id,
      title: event.title,
      location: event.location,
      startDate: event.startDate,
      endDate: event.endDate,
      allDay: event.allDay,
    })),
    now,
  );
}

export type ResolvedPlace = { location: string; latitude: number; longitude: number };

/**
 * Turns a calendar event's free-text location into coordinates.
 *
 * A calendar stores "Botanic Gardens" or a pasted street address; a stop needs
 * a lat/lng, because that is what picks the nearest NEA area. This runs the
 * text through the same Places lookup the add-plan form uses and takes the top
 * match — which is the same thing the user would do by hand, and the reason an
 * unresolvable location is reported rather than guessed at.
 */
export async function resolveEventLocation(
  locationText: string,
): Promise<ResolvedPlace | null> {
  try {
    const [best] = await searchPlaces(locationText);
    if (!best) return null;

    const details = await getPlaceDetails(best.placeId);
    return {
      location: details.displayName,
      latitude: details.latitude,
      longitude: details.longitude,
    };
  } catch {
    return null;
  }
}
