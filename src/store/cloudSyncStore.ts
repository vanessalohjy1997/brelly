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
  resetReady: () =>
    set({ settingsReady: false, routinesReady: false, slotsReady: false }),
}));

/** One flag, several eventual consumers — the skeleton and the materialiser. */
export function useCloudReady(): boolean {
  return useCloudSyncStore(
    (state) => state.settingsReady && state.routinesReady && state.slotsReady,
  );
}
