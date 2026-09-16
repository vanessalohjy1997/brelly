import { create } from "zustand";

/**
 * Whether this browser is holding Firestore's cache on disk or only in memory.
 *
 * The mobile app has no equivalent and needs none: `@react-native-firebase`
 * persists unconditionally. On the web the default cache is **memory-only**,
 * and `services/firebase.ts` asks for the persistent one — but that request can
 * be refused, in Safari's private mode and under Firefox's Enhanced Tracking
 * Protection, where IndexedDB is unavailable.
 *
 * A refusal is not an error the user can act on, so nothing throws. It is a
 * change in what the app promises: an edit made offline is gone on reload
 * rather than queued. That is worth saying out loud, which is why it is state
 * rather than a `console.warn`.
 */
export type LocalCacheMode = "persistent" | "memory";

type LocalCacheState = {
  mode: LocalCacheMode;
  /** The SDK's own reason, kept for the console rather than for the UI. */
  reason: string | null;
  setMode: (mode: LocalCacheMode, reason?: string | null) => void;
};

export const useLocalCacheStore = create<LocalCacheState>()((set) => ({
  // Optimistic on purpose: `getFirebaseFirestore()` runs lazily, so before the
  // first Firestore call there is nothing to report and "memory" would be a
  // warning about a situation that has not arisen.
  mode: "persistent",
  reason: null,
  setMode: (mode, reason = null) => set({ mode, reason }),
}));

/** True when an edit made offline will not survive a reload. */
export function useCacheIsDegraded(): boolean {
  return useLocalCacheStore((state) => state.mode === "memory");
}
