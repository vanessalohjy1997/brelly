import type { ItinerarySlot } from "@/types/itinerary";

export type ConflictKind = "overlap" | "implausible-gap";

export type ScheduleConflict = {
  kind: ConflictKind;
  slotA: ItinerarySlot;
  slotB: ItinerarySlot;
  detail: string;
};

// km/h — generous enough to avoid false positives for any Singapore transit
// (MRT, taxi, bus), while still catching "Changi to Jurong in 10 minutes".
// Only ever applied to a leg that ground transport could actually cover; see
// `impliesFlight`.
const MAX_PLAUSIBLE_SPEED_KMH = 60;

// km, straight-line. Past this there is no road or rail answer for a leg
// inside one itinerary, so the gap is a flight — and `MAX_PLAUSIBLE_SPEED_KMH`,
// a figure about city traffic, says nothing useful about it. Set well beyond
// the longest drive anyone would plan as a leg (Singapore to Kuala Lumpur is
// ~300 km, Tokyo to Osaka ~400 km) so a real ground journey is never mistaken
// for a flight.
const GROUND_TRANSPORT_LIMIT_KM = 500;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Whether getting from `a` to `b` means boarding a plane — in which case the
 * gap warning is suppressed, since it would fire on every leg of an overseas
 * itinerary and the user can do nothing about it mid-flight.
 *
 * Two signals, and both are needed. A country change is the direct evidence,
 * but `countryCode` is optional: it is absent on stops made before the field
 * existed and on calendar imports, and absent means *unknown*, never `"SG"` —
 * so a missing code must not be read as "same country as the other stop".
 * The distance ceiling is what catches those, and it also covers the legs a
 * country code cannot describe at all: a domestic flight, where both stops
 * carry the same code.
 */
function impliesFlight(
  a: ItinerarySlot,
  b: ItinerarySlot,
  distKm: number,
): boolean {
  if (a.countryCode && b.countryCode && a.countryCode !== b.countryCode) {
    return true;
  }
  return distKm > GROUND_TRANSPORT_LIMIT_KM;
}

export function detectScheduleConflicts(
  slots: ItinerarySlot[],
): ScheduleConflict[] {
  if (slots.length < 2) return [];

  const sorted = [...slots].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];

    const aEnd = new Date(a.endTime).getTime();
    const bStart = new Date(b.startTime).getTime();

    if (aEnd > bStart) {
      conflicts.push({
        kind: "overlap",
        slotA: a,
        slotB: b,
        detail: `"${a.label}" and "${b.label}" overlap`,
      });
      continue;
    }

    const gapMinutes = (bStart - aEnd) / 1000 / 60;
    if (gapMinutes <= 0) continue;

    const distKm = haversineKm(
      a.latitude,
      a.longitude,
      b.latitude,
      b.longitude,
    );
    if (impliesFlight(a, b, distKm)) continue;

    const reachableKm = (gapMinutes / 60) * MAX_PLAUSIBLE_SPEED_KMH;

    if (distKm > reachableKm) {
      const neededMin = Math.ceil((distKm / MAX_PLAUSIBLE_SPEED_KMH) * 60);
      conflicts.push({
        kind: "implausible-gap",
        slotA: a,
        slotB: b,
        detail: `${Math.round(distKm)} km between "${a.label}" and "${b.label}" — ${gapMinutes} min gap, needs ~${neededMin} min`,
      });
    }
  }

  return conflicts;
}
