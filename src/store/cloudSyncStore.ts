import { create } from "zustand";

type CloudSyncState = {
  /**
   * True once a store's first cloud snapshot has landed — cache or server,
   * never gated on the network (see FIREBASE_MIGRATION.md's "readiness gate
   * and a skeleton" section). `useCloudReady` is the AND of every store now
   * on Firestore.
   */
  settingsReady: boolean;
  setSettingsReady: (ready: boolean) => void;
  routinesReady: boolean;
  setRoutinesReady: (ready: boolean) => void;
  slotsReady: boolean;
  setSlotsReady: (ready: boolean) => void;
  /**
   * Set when sign-in or a listener fails outright (e.g. anonymous auth
   * disabled in the Firebase console, or a rules rejection) — the screens
   * gated on `useCloudReady()` would otherwise sit on their skeleton forever
   * with no sign anything went wrong. Cleared on the next successful
   * bootstrap or listener delivery.
   */
  bootstrapError: string | null;
  setBootstrapError: (error: string | null) => void;
  /** Drops every flag back to false — the account-link merge flow's step 6,
   * so the skeleton reappears while listeners are torn down and reattached
   * under the new uid. */
  resetReady: () => void;
};

export const useCloudSyncStore = create<CloudSyncState>()((set) => ({
  settingsReady: false,
  setSettingsReady: (ready) => set({ settingsReady: ready }),
  routinesReady: false,
  setRoutinesReady: (ready) => set({ routinesReady: ready }),
  slotsReady: false,
  setSlotsReady: (ready) => set({ slotsReady: ready }),
  bootstrapError: null,
  setBootstrapError: (error) => set({ bootstrapError: error }),
  resetReady: () =>
    set({
      settingsReady: false,
      routinesReady: false,
      slotsReady: false,
      bootstrapError: null,
    }),
}));

/** One flag, several eventual consumers — the skeleton and the materialiser. */
export function useCloudReady(): boolean {
  return useCloudSyncStore(
    (state) => state.settingsReady && state.routinesReady && state.slotsReady,
  );
}

/** What a skeleton screen shows instead of spinning forever — null while
 * bootstrap is still in progress or has succeeded. */
export function useCloudBootstrapError(): string | null {
  return useCloudSyncStore((state) => state.bootstrapError);
}

/**
 * What an error screen shows in place of a raw Firebase rejection (an
 * `[auth/unknown]`/`[firestore/permission-denied]` code means nothing to
 * someone who isn't debugging it). Shared between `useCloudBootstrap`
 * (sign-in failures) and `cloudListeners` (listener failures) so both read
 * the same way. The real error is still `console.error`'d at each call site
 * — this is only what the user sees.
 */
export function describeCloudSyncError(): string {
  return "We couldn't load your plans. Check your connection and try again.";
}
