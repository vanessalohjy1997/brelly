import { useEffect } from "react";

import { ensureAnonymousUser, getFirebaseAuth } from "@/services/firebase";
import { subscribeToSlotsCollection } from "@/services/itinerarySync";
import {
  confirmLocalDataMigration,
  enqueueLocalDataMigration,
} from "@/services/localDataMigration";
import { subscribeToRoutinesCollection } from "@/services/routinesSync";
import { subscribeToSettingsDoc } from "@/services/settingsSync";
import { useCloudReady, useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/store/settingsStore";

/**
 * Mounted once, at the root, ahead of `useRoutineSync()`/
 * `useNotificationSync()`. Signs in anonymously if needed, enqueues the
 * one-time local→cloud migration, and attaches the live listeners for every
 * store already on Firestore — then reports readiness so a screen can show a
 * skeleton instead of a flash of default/empty values.
 *
 * Nothing here waits on the network. `ensureAnonymousUser` resolves from the
 * Keychain-cached session on a returning launch, and the migration's writes
 * are enqueued rather than awaited — see FIREBASE_MIGRATION.md's
 * "enqueue/confirm split" — so an offline first launch after upgrade still
 * reaches a usable screen.
 */
export function useCloudBootstrap(): boolean {
  useEffect(() => {
    let cancelled = false;
    let unsubscribeSettings: (() => void) | undefined;
    let unsubscribeRoutines: (() => void) | undefined;
    let unsubscribeSlots: (() => void) | undefined;

    ensureAnonymousUser()
      .then(() => {
        if (cancelled) return;
        const uid = getFirebaseAuth().currentUser?.uid;
        if (!uid) return;

        const commit = enqueueLocalDataMigration(uid);

        unsubscribeSettings = subscribeToSettingsDoc(uid, (fields) => {
          useSettingsStore.setState({ ...DEFAULT_SETTINGS, ...fields });
          useCloudSyncStore.getState().setSettingsReady(true);
        });

        unsubscribeRoutines = subscribeToRoutinesCollection(
          uid,
          (routines) => {
            useRoutineStore.setState({ routines });
            useCloudSyncStore.getState().setRoutinesReady(true);
          },
        );

        unsubscribeSlots = subscribeToSlotsCollection(uid, (plans) => {
          useItineraryStore.setState({ plans });
          useCloudSyncStore.getState().setSlotsReady(true);
        });

        if (commit) confirmLocalDataMigration(uid, commit);
      })
      .catch(() => {
        // Backgrounded on purpose: a failure here leaves the readiness flags
        // false and any skeleton showing, rather than crashing the boot path.
      });

    return () => {
      cancelled = true;
      unsubscribeSettings?.();
      unsubscribeRoutines?.();
      unsubscribeSlots?.();
    };
  }, []);

  return useCloudReady();
}
