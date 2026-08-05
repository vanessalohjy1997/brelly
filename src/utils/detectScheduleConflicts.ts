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
const MAX_PLAUSIBLE_SPEED_KMH = 60;

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
