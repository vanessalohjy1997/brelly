"use client";

import { useCallback, useState } from "react";

import { reverseGeocode } from "@brelly/core";

export type CurrentLocationResult = {
  location: string;
  latitude: number;
  longitude: number;
};

/**
 * Names a coordinate.
 *
 * **Web has one geocoder where the phone has two**, and that is a real
 * reduction rather than a tidy-up. On the phone, Google's reverse geocode is
 * tried first and `expo-location`'s on-device one — Apple's CLGeocoder — is the
 * fallback for a failed request, an offline device or a key out of quota. The
 * browser has no on-device geocoder at all, so a failure here falls through to
 * the honest generic string instead. `formatReverseGeocodedAddress`, the
 * function that shaped Apple's placemarks into an address, has no caller here
 * and is not ported.
 *
 * The cost is bounded: this only fills the Location field in, and the field is
 * a free-text search over Google Places, so the stop can always be typed.
 */
async function describeCoordinates(
  latitude: number,
  longitude: number,
): Promise<string> {
  try {
    const address = await reverseGeocode(latitude, longitude);
    if (address) return address;
  } catch {
    // Nothing to fall back to — see above.
  }
  return "Current location";
}

/**
 * What a refusal costs, said plainly: nothing but the typing. The old phrasing
 * ("Location permission denied") named the failure and left the reader to guess
 * whether the form still worked.
 */
const DENIED_MESSAGE =
  "Location is blocked for this site, so this couldn't be filled in. You can still type the place.";

const UNAVAILABLE_MESSAGE = "Could not get your location";

export function useCurrentLocation() {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Separate from `error` because it decides what the form *says*, not only
  // that something failed: a refusal is the one failure here the user can do
  // something about, and only in the browser's own site-settings panel.
  const [permissionDenied, setPermissionDenied] = useState(false);

  const getCurrentLocation =
    useCallback(async (): Promise<CurrentLocationResult | null> => {
      setIsLocating(true);
      setError(null);
      setPermissionDenied(false);
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error("Geolocation is unavailable"));
              return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              // The default is coarse, and in a city as dense as Singapore a
              // ~100m fix lands on a neighbouring street — which the reverse
              // geocode then names. This is a one-shot read, so the extra time
              // is worth it.
              enableHighAccuracy: true,
              timeout: 10_000,
            });
          },
        );

        const { latitude, longitude } = position.coords;
        return {
          location: await describeCoordinates(latitude, longitude),
          latitude,
          longitude,
        };
      } catch (thrown) {
        const denied =
          typeof GeolocationPositionError !== "undefined" &&
          thrown instanceof GeolocationPositionError &&
          thrown.code === thrown.PERMISSION_DENIED;
        setPermissionDenied(denied);
        setError(denied ? DENIED_MESSAGE : UNAVAILABLE_MESSAGE);
        return null;
      } finally {
        setIsLocating(false);
      }
    }, []);

  return { getCurrentLocation, isLocating, error, permissionDenied };
}
