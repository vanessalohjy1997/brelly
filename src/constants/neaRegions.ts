import { NeaAreaMetadata, NeaRegion } from "@/types/weather";

// ─── Region boundaries ────────────────────────────────────────────────────────
// Derived from NEA's regionMetadata coordinates in the API response.
// Boundaries are geographic facts, not a mapping we maintain — stable by nature.

type RegionBoundary = {
  region: NeaRegion;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

const REGION_BOUNDARIES: RegionBoundary[] = [
  {
    region: "north",
    latMin: 1.38,
    latMax: 1.48,
    lngMin: 103.62,
    lngMax: 103.88,
  },
  {
    region: "south",
    latMin: 1.22,
    latMax: 1.32,
    lngMin: 103.72,
    lngMax: 103.88,
  },
  { region: "east", latMin: 1.3, latMax: 1.4, lngMin: 103.88, lngMax: 104.05 },
  { region: "west", latMin: 1.3, latMax: 1.42, lngMin: 103.62, lngMax: 103.78 },
  {
    region: "central",
    latMin: 1.3,
    latMax: 1.4,
    lngMin: 103.78,
    lngMax: 103.88,
  },
];

/**
 * Derives a NEA region purely from coordinates.
 * Google Places gives us lat/lng when the user picks a location — use that
 * directly rather than maintaining any area → region mapping.
 * Falls back to 'central' if coordinates don't fall cleanly in a boundary.
 */
export function getRegionFromCoordinates(lat: number, lng: number): NeaRegion {
  const match = REGION_BOUNDARIES.find(
    (b) =>
      lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax,
  );
  return match?.region ?? "central";
}

export type Located = { latitude: number; longitude: number };

/**
 * The item whose coordinates are closest to the given lat/lng.
 * Works for anything NEA labels with a position — 2hr forecast areas and
 * real-time sensor stations alike — so both use the same proximity rule.
 */
export function findNearest<T extends Located>(
  latitude: number,
  longitude: number,
  items: T[],
): T | null {
  if (items.length === 0) return null;

  let nearest = items[0];
  let nearestDistance = squaredDistance(latitude, longitude, nearest);

  for (const item of items.slice(1)) {
    const distance = squaredDistance(latitude, longitude, item);
    if (distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/**
 * Finds the NEA area whose label coordinates are closest to the given
 * lat/lng. areaMetadata comes from the live twoHrForecast response — never
 * hardcoded, since NEA occasionally adjusts area boundaries/labels.
 * Used to match a slot's coordinates to the area name the 2hr API expects.
 */
export function findNearestArea(
  latitude: number,
  longitude: number,
  areaMetadata: NeaAreaMetadata[],
): string | null {
  return findNearest(latitude, longitude, areaMetadata)?.name ?? null;
}

// Singapore spans under 50km, so a flat-earth squared-distance comparison
// (no need for true haversine) is accurate enough to rank by proximity.
function squaredDistance(lat: number, lng: number, item: Located): number {
  const dLat = lat - item.latitude;
  const dLng = lng - item.longitude;
  return dLat * dLat + dLng * dLng;
}
