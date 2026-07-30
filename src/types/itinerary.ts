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
};

export type DayPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  slots: ItinerarySlot[];
};
