import { subscribeToSlotsCollection } from "@/services/itinerarySync";
import { subscribeToRoutinesCollection } from "@/services/routinesSync";
import { subscribeToSettingsDoc } from "@/services/settingsSync";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/store/settingsStore";

type Unsubs = {
  settings?: () => void;
  routines?: () => void;
  slots?: () => void;
};

let unsubs: Unsubs = {};

/**
 * Attaches the three live `onSnapshot` mirrors for a uid, tearing down
 * whatever was attached before. Extracted out of `useCloudBootstrap`'s
 * mount effect so the account-link merge flow can re-run the exact same
 * attach logic after switching to a different uid, outside of React's effect
 * lifecycle — see FIREBASE_MIGRATION.md's "Account linking" step 6.
 */
export function attachCloudListeners(uid: string): void {
  detachCloudListeners();

  unsubs.settings = subscribeToSettingsDoc(uid, (fields) => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, ...fields });
    useCloudSyncStore.getState().setSettingsReady(true);
  });

  unsubs.routines = subscribeToRoutinesCollection(uid, (routines) => {
    useRoutineStore.setState({ routines });
    useCloudSyncStore.getState().setRoutinesReady(true);
  });

  unsubs.slots = subscribeToSlotsCollection(uid, (plans) => {
    useItineraryStore.setState({ plans });
    useCloudSyncStore.getState().setSlotsReady(true);
  });
}

export function detachCloudListeners(): void {
  unsubs.settings?.();
  unsubs.routines?.();
  unsubs.slots?.();
  unsubs = {};
}
