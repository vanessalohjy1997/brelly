import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import { getRegionFromCoordinates } from "@/constants/neaRegions";
import { getUpcomingForecast } from "@/services/weather";
import type { NeaRegion } from "@/types/weather";

export type PermissionState =
  | "checking"
  | "unprompted"
  | "granted"
  | "denied"
  | "unavailable";

/**
 * Weather for whatever's coming up nearby, used for the "no plans yet" empty
 * state.
 *
 * The permission is **not** requested on mount. It used to be, which meant the
 * OS dialog appeared before the user had any idea what it was for, and a
 * denial silently removed the whole feature with no way back — one tap in the
 * first five seconds. Instead this reports `unprompted` and waits for
 * `requestPermission()`, so the caller can explain first and offer a way to
 * recover afterwards.
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

  const locate = useCallback(async () => {
    try {
      const position = await Location.getCurrentPositionAsync({});
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
      // Permission is held but no fix came back — a different failure from a
      // refusal, and not one re-prompting would fix.
      setPermission("unavailable");
    }
  }, []);

  // Read the existing status without prompting. Someone who already granted
  // it on a previous run shouldn't have to press a button again.
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (status === "granted") {
        await locate();
        return;
      }
      setPermission(status === "denied" ? "denied" : "unprompted");
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, locate]);

  /** Prompts for permission. Call this from an affordance that says why. */
  const requestPermission = useCallback(async () => {
    setPermission("checking");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPermission("denied");
      return;
    }
    await locate();
  }, [locate]);

  const query = useQuery({
    queryKey: ["nearbyForecast", region, hours],
    queryFn: () => getUpcomingForecast(region as NeaRegion, hours),
    enabled: enabled && permission === "granted" && !!region,
    staleTime: 1000 * 60 * 10,
  });

  return {
    isAvailable: permission === "granted",
    isLoading: enabled && (permission === "checking" || query.isLoading),
    permission,
    requestPermission,
    forecasts: query.data ?? [],
    region,
    coords,
  };
}
