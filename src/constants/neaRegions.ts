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
  if (areaMetadata.length === 0) return null;

  let nearest = areaMetadata[0];
  let nearestDistance = squaredDistance(latitude, longitude, nearest);

  for (const area of areaMetadata.slice(1)) {
    const distance = squaredDistance(latitude, longitude, area);
    if (distance < nearestDistance) {
      nearest = area;
      nearestDistance = distance;
    }
  }

  return nearest.name;
}

// Singapore spans under 50km, so a flat-earth squared-distance comparison
// (no need for true haversine) is accurate enough to rank areas by proximity.
function squaredDistance(
  lat: number,
  lng: number,
  area: NeaAreaMetadata,
): number {
  const dLat = lat - area.latitude;
  const dLng = lng - area.longitude;
  return dLat * dLat + dLng * dLng;
}
