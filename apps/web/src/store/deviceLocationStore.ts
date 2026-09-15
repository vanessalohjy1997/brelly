import { create } from "zustand";

import { getRegionFromCoordinates, type NeaRegion } from "@brelly/core";

export type PermissionState =
  | "checking"
  | "unprompted"
  | "granted"
  | "denied"
  | "unavailable";

export type Coordinates = { latitude: number; longitude: number };

type DeviceLocationState = {
  permission: PermissionState;
  region: NeaRegion | null;
  /**
   * Kept alongside the region so callers that need a point rather than a region
   * (nearest-station readings) reuse this one permission flow instead of
   * prompting again.
   */
  coords: Coordinates | null;

  /**
   * Reads the browser's answer **without** prompting, and resolves a position
   * if the permission is already held. Safe to call on every mount and on every
   * return to the tab: concurrent calls share one round trip.
   */
  sync: () => Promise<void>;

  /** Prompts. Call this from an affordance that has said why first. */
  request: () => Promise<void>;
};

/**
 * Where the browser is, and whether we are allowed to ask.
 *
 * A store rather than component state, for the reason the mobile version gives:
 * two screens calling the same hook used to mean two independent copies of this
 * state machine, and a grant reached only the one that asked. The web has the
 * same shape through a different door — two tabs, and a permission changed in
 * the site-settings panel without the page being told.
 *
 * Not persisted. The browser owns this answer and can change it while the tab
 * is in the background, so a remembered copy would only be a way to be
 * confidently wrong.
 *
 * The one real difference from the phone is how a *refusal* behaves. A browser
 * that has been told "block" answers `getCurrentPosition` with
 * `PERMISSION_DENIED` immediately and shows no dialog — the same dead end iOS
 * has, but with no Settings deep link to offer, because a page cannot open the
 * browser's own permission UI. `NearbyWeatherPrompt` says where the control is
 * instead.
 */
let generation = 0;
let pendingSync: Promise<void> | null = null;
let pendingSyncGeneration = 0;

/** A one-shot read at the best accuracy the device will give. */
const POSITION_OPTIONS: PositionOptions = {
  // The default is coarse, and in a city as dense as Singapore a ~100m fix
  // lands on a neighbouring street — which the reverse geocode then names.
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 60_000,
};

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, POSITION_OPTIONS);
  });
}

/**
 * The Permissions API, which is the browser's equivalent of reading the status
 * without prompting — and the thing that makes this store's `sync`/`request`
 * split possible at all.
 *
 * Returns `null` where it is unavailable or refuses the query, which is not the
 * same as "denied": Safari shipped geolocation long before it shipped a
 * Permissions API entry for it. A `null` here means "we cannot know without
 * asking", which is exactly what `unprompted` means to every consumer.
 */
async function readPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined") return "unavailable";
  if (!navigator.geolocation) return "unavailable";
  if (!navigator.permissions?.query) return null;

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "unprompted";
  } catch {
    return null;
  }
}

export const useDeviceLocationStore = create<DeviceLocationState>()((set) => {
  const commit = (
    forGeneration: number,
    next: Partial<Pick<DeviceLocationState, "permission" | "region" | "coords">>,
  ) => {
    if (forGeneration === generation) set(next);
  };

  const locate = async (forGeneration: number) => {
    try {
      const { coords } = await getCurrentPosition();
      commit(forGeneration, {
        coords: { latitude: coords.latitude, longitude: coords.longitude },
        region: getRegionFromCoordinates(coords.latitude, coords.longitude),
        permission: "granted",
      });
    } catch (error) {
      // A refusal and a failed fix are different answers, and only one of them
      // is worth offering a way back from. `PERMISSION_DENIED` is 1.
      const denied =
        typeof GeolocationPositionError !== "undefined" &&
        error instanceof GeolocationPositionError &&
        error.code === error.PERMISSION_DENIED;
      commit(forGeneration, {
        permission: denied ? "denied" : "unavailable",
        region: null,
        coords: null,
      });
    }
  };

  return {
    permission: "checking",
    region: null,
    coords: null,

    sync: () => {
      // Only share a round trip that is still current. One superseded by a
      // `request()` will commit nothing, so handing it to a later caller would
      // silently swallow that caller's read.
      if (pendingSync && pendingSyncGeneration === generation) return pendingSync;

      const forGeneration = ++generation;
      pendingSyncGeneration = forGeneration;
      pendingSync = (async () => {
        const state = await readPermissionState();
        if (state === "granted") {
          await locate(forGeneration);
          return;
        }
        // Region and coords go with it. This read is the only thing that
        // notices a grant switched off in the site-settings panel, and leaving
        // the last known point behind meant "Right now" kept reporting the
        // weather at a location the user had just revoked access to.
        commit(forGeneration, {
          permission: state ?? "unprompted",
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
      // There is no separate "request permission" call in the browser: asking
      // for a position *is* the prompt, and a blocked site is answered
      // immediately with `PERMISSION_DENIED` and no dialog. `locate` already
      // tells those two apart, so the request path is the read path.
      await locate(forGeneration);
    },
  };
});

/**
 * Returns the store to its cold-start state, including the module-level
 * generation counter that `setState` alone cannot reach. For tests — nothing in
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
