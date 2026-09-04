import * as Location from "expo-location";
import { create } from "zustand";

import { getRegionFromCoordinates } from "@/constants/neaRegions";
import type { NeaRegion } from "@/types/weather";

export type PermissionState =
  | "checking"
  | "unprompted"
  | "granted"
  | "denied"
  | "unavailable";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

type DeviceLocationState = {
  permission: PermissionState;
  region: NeaRegion | null;
  /**
   * Kept alongside the region so callers that need a point rather than a
   * region (nearest-station readings) reuse this one permission flow instead
   * of prompting again.
   */
  coords: Coordinates | null;

  /**
   * Reads the OS status **without** prompting, and resolves a position if the
   * permission is already held. Safe to call from every mount and from every
   * return to the foreground: concurrent calls share one round trip.
   */
  sync: () => Promise<void>;

  /** Prompts. Call this from an affordance that has said why first. */
  request: () => Promise<void>;
};

/**
 * Where the device is, and whether we are allowed to ask.
 *
 * This is client state about the hardware, not fetched data, so it is zustand
 * and not a query — the forecast it feeds stays in `useNearbyForecast`'s
 * query. It lives in a store rather than in that hook's `useState` because
 * native tabs keep every screen mounted: two screens calling the hook used to
 * mean two independent copies of this state machine, so a grant reached only
 * the one that asked. Today would keep offering "Show weather near me" after
 * Plans had already been shown the forecast, and only tapping it again — a
 * second prompt for a permission already held — got Today out of it.
 *
 * Not persisted. The OS owns this answer and can change it while the app is
 * backgrounded, so a remembered copy would only be a way to be confidently
 * wrong; every consumer re-reads instead.
 */

/**
 * Bumped by every call that will write a result. A result whose generation is
 * stale is dropped, which is what stops a `sync()` started while the user was
 * still deciding from landing on top of the answer they just gave.
 */
let generation = 0;
/** The in-flight `sync()`, so N mounted consumers cost one round trip. */
let pendingSync: Promise<void> | null = null;
let pendingSyncGeneration = 0;

export const useDeviceLocationStore = create<DeviceLocationState>()((set) => {
  const commit = (
    forGeneration: number,
    next: Partial<Pick<DeviceLocationState, "permission" | "region" | "coords">>,
  ) => {
    if (forGeneration === generation) set(next);
  };

  const locate = async (forGeneration: number) => {
    try {
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      commit(forGeneration, {
        coords: { latitude, longitude },
        region: getRegionFromCoordinates(latitude, longitude),
        permission: "granted",
      });
    } catch {
      // Permission is held but no fix came back — a different failure from a
      // refusal, and not one re-prompting would fix.
      commit(forGeneration, { permission: "unavailable" });
    }
  };

  return {
    permission: "checking",
    region: null,
    coords: null,

    sync: () => {
      // Only share a round trip that is still current. One superseded by a
      // `request()` will commit nothing, so handing it to a later caller
      // would silently swallow that caller's read.
      if (pendingSync && pendingSyncGeneration === generation) return pendingSync;

      const forGeneration = ++generation;
      pendingSyncGeneration = forGeneration;
      pendingSync = (async () => {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          await locate(forGeneration);
          return;
        }
        // Region and coords go with it. This read is the only thing that
        // notices a grant switched off in system Settings, and leaving the
        // last known point behind meant "Right now" kept reporting the weather
        // at a location the user had just revoked access to.
        commit(forGeneration, {
          permission: status === "denied" ? "denied" : "unprompted",
          region: null,
          coords: null,
        });
      })().finally(() => {
        if (pendingSyncGeneration === forGeneration) pendingSync = null;
      });

      return pendingSync;
    },

    request: async () => {
      const forGeneration = ++generation;
      set({ permission: "checking" });
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        commit(forGeneration, {
          permission: "denied",
          region: null,
          coords: null,
        });
        return;
      }
      await locate(forGeneration);
    },
  };
});

/**
 * Returns the store to its cold-start state, including the module-level
 * generation counter that `setState` alone can't reach. For tests — nothing in
 * the app clears this, since the permission outlives every screen.
 */
export function resetDeviceLocationStore() {
  generation = 0;
  pendingSync = null;
  pendingSyncGeneration = 0;
  useDeviceLocationStore.setState({
    permission: "checking",
    region: null,
    coords: null,
  });
}
