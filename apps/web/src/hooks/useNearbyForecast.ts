"use client";

import { useQuery } from "@tanstack/react-query";

import { getUpcomingForecast, type NeaRegion } from "@brelly/core";
import { useDeviceLocationStore } from "@/store/deviceLocationStore";

import { useDeviceLocationPermission } from "./useDeviceLocationPermission";

/**
 * Weather for whatever is coming up nearby, for the "no plans yet" empty state.
 *
 * The permission is **not** requested on mount. It used to be on the phone,
 * which meant the dialog appeared before the user had any idea what it was for,
 * and a refusal silently removed the whole feature with no way back. Instead
 * this reports `unprompted` and waits for `requestPermission()`, so the caller
 * can explain first — and on the web that explanation has to do more work, not
 * less: a blocked site gets no dialog at all on the second ask.
 */
export function useNearbyForecast(
  enabled: boolean,
  {
    hours = 6,
    // Whether to fetch the upcoming-forecast preview on top of resolving the
    // location. Today keeps the location machinery on even with plans — the
    // "Right now" card is anchored to the device point, not to a stop — but
    // only wants the forecast preview in its empty state.
    fetchForecast = enabled,
  }: { hours?: number; fetchForecast?: boolean } = {},
) {
  const { permission, request: requestPermission } =
    useDeviceLocationPermission(enabled);
  const region = useDeviceLocationStore((state) => state.region);
  const coords = useDeviceLocationStore((state) => state.coords);

  const query = useQuery({
    queryKey: ["nearbyForecast", region, hours],
    queryFn: () => getUpcomingForecast(region as NeaRegion, hours),
    enabled: enabled && fetchForecast && permission === "granted" && !!region,
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
