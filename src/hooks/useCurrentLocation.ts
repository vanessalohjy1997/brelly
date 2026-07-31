import * as Location from "expo-location";
import { useCallback, useState } from "react";

import { reverseGeocode } from "@/services/geocoding";

export type CurrentLocationResult = {
  location: string;
  latitude: number;
  longitude: number;
};

const isFilled = (part: string | null | undefined): part is string =>
  Boolean(part && part.trim());

const isJustANumber = (part: string) => /^\d+$/.test(part.trim());

function join(parts: (string | null | undefined)[], separator: string): string {
  return parts
    .filter(isFilled)
    .map((part) => part.trim())
    .join(separator);
}

/**
 * A placemark `name` is only worth showing when it adds something the street
 * line doesn't. iOS commonly sets it to the street address itself ("90 Thomson
 * Terrace") or to the bare street number ("90") — showing either alongside the
 * street line just repeats it.
 */
function isDistinctPlaceName(
  name: string | null | undefined,
  streetLine: string,
): name is string {
  if (!isFilled(name) || isJustANumber(name)) return false;
  return !streetLine.toLowerCase().includes(name.trim().toLowerCase());
}

/**
 * Formats an expo-location reverse-geocode result into a single display
 * string, mirroring the shape SlotForm expects from Google Places.
 *
 * Only reached when Google's reverse geocode is unavailable — on iOS this is
 * Apple's CLGeocoder, which in Singapore often knows nothing beyond the country.
 *
 * `formattedAddress` (Android-only) is preferred when present since it's
 * already composed; otherwise the address is assembled as
 * "<place name>, <street number> <street>, <city> <postal code>". The street
 * number is only ever emitted attached to a street name — on its own it isn't
 * an address, it's the "20, Singapore" bug.
 */
export function formatReverseGeocodedAddress(
  address: Location.LocationGeocodedAddress,
): string {
  if (address.formattedAddress) return address.formattedAddress;

  const streetLine = join([address.streetNumber, address.street], " ");
  const locality = join(
    [
      address.city ?? address.district ?? address.subregion ?? address.region,
      address.postalCode,
    ],
    " ",
  );

  const parts = [
    isDistinctPlaceName(address.name, streetLine) ? address.name.trim() : null,
    isFilled(streetLine) && !isJustANumber(streetLine) ? streetLine : null,
    locality,
  ].filter(isFilled);
  const deduped = Array.from(new Set(parts));

  return deduped.length > 0 ? deduped.join(", ") : "Current location";
}

/**
 * Names a coordinate, preferring Google's reverse geocode and falling back to
 * the on-device one. The fallback exists for the cases Google can't cover — a
 * failed request, an offline device, a key that's out of quota — where a
 * coarse address still beats no location at all.
 */
async function describeCoordinates(
  latitude: number,
  longitude: number,
): Promise<string> {
  try {
    const address = await reverseGeocode(latitude, longitude);
    if (address) return address;
  } catch {
    // Fall through to the device geocoder.
  }

  const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
  return address ? formatReverseGeocodedAddress(address) : "Current location";
}

export function useCurrentLocation() {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation =
    useCallback(async (): Promise<CurrentLocationResult | null> => {
      setIsLocating(true);
      setError(null);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied");
          return null;
        }

        const position = await Location.getCurrentPositionAsync({
          // The default (`Accuracy.Balanced`) is only good to ~100m, which in a
          // city as dense as Singapore lands on a neighbouring street — and the
          // reverse geocode then names that street. This is a one-shot read, so
          // the extra time/battery of the best available fix is worth it.
          accuracy: Location.Accuracy.Highest,
        });
        const { latitude, longitude } = position.coords;

        return {
          location: await describeCoordinates(latitude, longitude),
          latitude,
          longitude,
        };
      } catch {
        setError("Could not get your location");
        return null;
      } finally {
        setIsLocating(false);
      }
    }, []);

  return { getCurrentLocation, isLocating, error };
}
