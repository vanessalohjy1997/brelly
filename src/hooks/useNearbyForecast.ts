import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { getUpcomingForecast } from "@/services/weather";
import { useDeviceLocationStore } from "@/store/deviceLocationStore";
import type { NeaRegion } from "@/types/weather";

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
export function useNearbyForecast(enabled: boolean, hours: number = 6) {
  const permission = useDeviceLocationStore((state) => state.permission);
  const region = useDeviceLocationStore((state) => state.region);
  const coords = useDeviceLocationStore((state) => state.coords);
  const sync = useDeviceLocationStore((state) => state.sync);
  const requestPermission = useDeviceLocationStore((state) => state.request);

  // Read the existing status without prompting. Someone who already granted
  // it on a previous run — or on the onboarding primer, or on the other tab —
  // shouldn't have to press a button again.
  useEffect(() => {
    if (!enabled) return;
    void sync();
  }, [enabled, sync]);

  // The only way back from a refusal is the system Settings app, and the only
  // way back from a missing fix is walking somewhere with a view of the sky.
  // Both change the answer while we are backgrounded and neither tells us, so
  // re-read on the way in — the same reason `useNotificationPermission` does.
  // A recheck is pointless in the other three states: `unprompted` can't be
  // granted from Settings (an app that has never asked isn't listed there),
  // and the rest are already settled.
  const isRecoverable = permission === "denied" || permission === "unavailable";
  useEffect(() => {
    if (!enabled || !isRecoverable) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => subscription.remove();
  }, [enabled, isRecoverable, sync]);

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
