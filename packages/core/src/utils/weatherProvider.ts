export type WeatherProvider = "nea" | "openMeteo";

// A generous box around Singapore, not `neaRegions.ts`'s five region
// boundaries — those answer "which NEA region", this answers "is NEA data
// meaningful here at all". Padded past the mainland to cover Tuas, Jurong
// Island, and the southern islands, with margin for GPS jitter near the
// coast.
const SINGAPORE_BOUNDS = {
  latMin: 1.13,
  latMax: 1.48,
  lngMin: 103.59,
  lngMax: 104.1,
};

export function isInSingapore(latitude: number, longitude: number): boolean {
  return (
    latitude >= SINGAPORE_BOUNDS.latMin &&
    latitude <= SINGAPORE_BOUNDS.latMax &&
    longitude >= SINGAPORE_BOUNDS.lngMin &&
    longitude <= SINGAPORE_BOUNDS.lngMax
  );
}

/**
 * Which weather API a location's forecasts should come from. Derived once
 * from coordinates at slot creation, same as `neaRegion` — see
 * `ItinerarySlot.provider`.
 */
export function deriveWeatherProvider(
  latitude: number,
  longitude: number,
): WeatherProvider {
  return isInSingapore(latitude, longitude) ? "nea" : "openMeteo";
}

/**
 * Absent reads as `"nea"` — the answer that matches every slot's actual
 * behaviour before this feature existed, so slots created before it needs no
 * store migration. Read a slot's provider through this rather than comparing
 * `slot.provider` directly.
 */
export function resolveSlotProvider(
  provider: WeatherProvider | undefined,
): WeatherProvider {
  return provider ?? "nea";
}
