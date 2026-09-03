import { useEffect } from "react";
import { AppState } from "react-native";

import { useDeviceLocationStore } from "@/store/deviceLocationStore";

/**
 * Whether Brelly may read the device location, kept honest without prompting.
 *
 * Two effects, both of which exist because the OS owns this answer and changes
 * it behind the app's back:
 *
 * - Read the existing status on mount. Someone who granted it on a previous
 *   run — or on the onboarding primer, or on another tab — shouldn't be asked
 *   again.
 * - Re-read on every return to the foreground, from *any* state. The system
 *   Settings app is where this answer is changed and the app is not told, so
 *   coming back is the only chance to notice. This used to fire only while the
 *   permission was `denied` or `unavailable` — the states with something to
 *   recover — which missed the change in the other direction entirely: a grant
 *   switched off in Settings left every screen still saying "Location is on",
 *   and the store still holding the point it had. It also missed Android,
 *   where an app that has never asked is still listed in system settings and
 *   can be granted from there without ever seeing a dialog.
 *
 *   The cost of not gating is one `getForegroundPermissionsAsync` per
 *   foreground, and — while granted — the position read that follows it. That
 *   is the right trade: the reading it feeds is "the weather where you are
 *   now", which is a different place after a trip out of the app anyway.
 *
 * Lives here rather than in `useNearbyForecast` because Settings needs the
 * same two effects for its Location row and nothing else that hook does.
 */
export function useDeviceLocationPermission(enabled = true) {
  const permission = useDeviceLocationStore((state) => state.permission);
  const sync = useDeviceLocationStore((state) => state.sync);
  const request = useDeviceLocationStore((state) => state.request);

  useEffect(() => {
    if (!enabled) return;
    void sync();
  }, [enabled, sync]);

  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => subscription.remove();
  }, [enabled, sync]);

  return { permission, request };
}
