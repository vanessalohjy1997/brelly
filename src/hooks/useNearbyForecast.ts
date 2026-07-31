import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

import { getRegionFromCoordinates } from "@/constants/neaRegions";
import { getUpcomingForecast } from "@/services/weather";
import type { NeaRegion } from "@/types/weather";

type PermissionState = "checking" | "granted" | "denied";

/**
 * Weather for whatever's coming up nearby, used for the "no plans yet"
 * empty state. Only requests location permission when `enabled` — callers
 * pass the same condition that shows the empty state, so a screen with
 * plans never triggers a permission prompt. Denial (or an undetermined
 * permission the user doesn't grant) is silent by design: no error is
 * surfaced, the caller just falls back to the plain empty state.
 */
export function useNearbyForecast(enabled: boolean, hours: number = 6) {
  const [permission, setPermission] = useState<PermissionState>("checking");
  const [region, setRegion] = useState<NeaRegion | null>(null);
  // Exposed alongside the region so callers that need a point rather than a
  // region (nearest-station readings) can reuse this one permission flow
  // instead of prompting again.
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setPermission("denied");
        return;
      }

      try {
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setRegion(
          getRegionFromCoordinates(
            position.coords.latitude,
            position.coords.longitude,
          ),
        );
        setPermission("granted");
      } catch {
        if (!cancelled) setPermission("denied");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const query = useQuery({
    queryKey: ["nearbyForecast", region, hours],
    queryFn: () => getUpcomingForecast(region as NeaRegion, hours),
    enabled: enabled && permission === "granted" && !!region,
    staleTime: 1000 * 60 * 10,
  });

  return {
    isAvailable: permission === "granted",
    isLoading: enabled && (permission === "checking" || query.isLoading),
    forecasts: query.data ?? [],
    region,
    coords,
  };
}
