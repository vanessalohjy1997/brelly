import * as Location from "expo-location";
import { useCallback, useState } from "react";

export type CurrentLocationResult = {
  location: string;
  latitude: number;
  longitude: number;
};

/**
 * Formats an expo-location reverse-geocode result into a single display
 * string, mirroring the shape SlotForm expects from Google Places.
 * `formattedAddress` (Android-only) is preferred when present since it's
 * already composed; otherwise falls back to landmark name / street / city,
 * deduped in case the placemark's name repeats its street.
 */
export function formatReverseGeocodedAddress(
  address: Location.LocationGeocodedAddress,
): string {
  if (address.formattedAddress) return address.formattedAddress;

  const parts = [address.name, address.street, address.city].filter(
    (part): part is string => Boolean(part),
  );
  const deduped = Array.from(new Set(parts));

  return deduped.length > 0 ? deduped.join(", ") : "Current location";
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

        const position = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = position.coords;

        const [address] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        return {
          location: address
            ? formatReverseGeocodedAddress(address)
            : "Current location",
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
