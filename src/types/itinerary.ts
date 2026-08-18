import type { WeatherProvider } from "@/utils/weatherProvider";
import type { SlotKind } from "@/utils/slotKind";

import { NeaRegion } from "./weather";

export type ItinerarySlot = {
  id: string;
  label: string;
  location: string; // human-readable display name
  neaRegion: NeaRegion; // derived once from lat/lng on slot creation
  // Which weather API this slot's forecast comes from, derived once from
  // lat/lng on slot creation, same as `neaRegion`. Absent on slots created
  // before this existed, which reads as "nea" — the answer that matches
  // every slot's actual behaviour before this feature existed. Read it
  // through `resolveSlotProvider` rather than comparing directly. No store
  // migration needed. `neaRegion` stays populated even for an overseas slot
  // (it degrades to the harmless "central" fallback `getRegionFromCoordinates`
  // already produces for any out-of-Singapore coordinate) rather than being
  // made optional, so nothing else has to change to tolerate a missing region.
  provider?: WeatherProvider;
  latitude: number; // from Google Places
  longitude: number; // from Google Places
  startTime: string;
  endTime: string;
  // Set after a rain notification is scheduled for this slot, so it can be
  // cancelled later (on delete, or before rescheduling on edit).
  notificationId?: string;
  // The lead time the scheduled alert was created against. Without this the
  // resync sees "has an alert, still rainy" and leaves an alert scheduled at
  // the old lead time forever, so changing the setting would only ever apply
  // to plans created afterwards. Absent on slots predating the setting, which
  // reads as "the old 45-minute default" — no store migration needed.
  notificationLeadMinutes?: number;
  // Per-slot opt-out. Absent on slots created before this existed, which
  // reads as "not muted" — no store migration needed.
  notificationsMuted?: boolean;
  // Whether this stop is under a roof. Absent on slots created before this
  // existed, and on calendar imports, which reads as "outdoor" — the answer
  // that leaves rain alerts behaving exactly as they did. Read it through
  // `resolveSlotKind` rather than comparing directly. No store migration
  // needed.
  kind?: SlotKind;
  // The routine that filled this day in. Absent on hand-made stops, on
  // calendar imports, and on a stop the user edited or deleted with "this day
  // only" — detaching clears it, which is what makes that choice permanent.
  // Absent reads as "belongs to nobody", the behaviour every slot had before
  // routines existed, so no store migration is needed.
  routineId?: string;
  notes?: string;
};

export type DayPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  slots: ItinerarySlot[];
};
