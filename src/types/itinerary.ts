import { NeaRegion } from "./weather";

export type ItinerarySlot = {
  id: string;
  label: string;
  location: string; // human-readable display name
  neaRegion: NeaRegion; // derived once from lat/lng on slot creation
  latitude: number; // from Google Places
  longitude: number; // from Google Places
  startTime: string;
  endTime: string;
  // Set after a rain notification is scheduled for this slot, so it can be
  // cancelled later (on delete, or before rescheduling on edit).
  notificationId?: string;
  // Per-slot opt-out. Absent on slots created before this existed, which
  // reads as "not muted" — no store migration needed.
  notificationsMuted?: boolean;
};

export type DayPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  slots: ItinerarySlot[];
};
