import { useQuery } from "@tanstack/react-query";

import { useDeviceLocationPermission } from "@/hooks/useDeviceLocationPermission";
import {
  getUpcomingForecast,
  type NeaRegion,
} from "@brelly/core";
import { useDeviceLocationStore } from "@/store/deviceLocationStore";

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
 *
 * The permission itself lives in `deviceLocationStore`, not here: native tabs
 * keep both consuming screens mounted at once, and component-local state gave
 * each of them its own copy that the other's grant never reached.
 */
export function useNearbyForecast(
  enabled: boolean,
  {
    hours = 6,
    // Whether to fetch the upcoming-forecast preview on top of resolving the
    // device location. Today keeps the location machinery on even with plans
    // — the "Right now" live-conditions card is anchored to the device point,
    // not a stop — but only wants the forecast preview in its empty state.
    // Defaults to `enabled`, so `useNearbyForecast(true)` still gets both.
    fetchForecast = enabled,
  }: { hours?: number; fetchForecast?: boolean } = {},
) {
  // The permission is not requested here — `useDeviceLocationPermission` only
  // reads it, and re-reads it on the way back from system Settings.
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
