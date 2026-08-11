import { useEffect } from "react";

import { resumePendingMergeIfNeeded } from "@/services/accountLinkService";
import { attachCloudListeners, detachCloudListeners } from "@/services/cloudListeners";
import { ensureAnonymousUser, getFirebaseAuth } from "@/services/firebase";
import {
  confirmLocalDataMigration,
  enqueueLocalDataMigration,
} from "@/services/localDataMigration";
import { useCloudReady } from "@/store/cloudSyncStore";

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

    ensureAnonymousUser()
      .then(() => {
        if (cancelled) return;
        const uid = getFirebaseAuth().currentUser?.uid;
        if (!uid) return;

        const commit = enqueueLocalDataMigration(uid);

        attachCloudListeners(uid);

        if (commit) confirmLocalDataMigration(uid, commit);

        // No-ops unless a previous launch was killed mid account-link merge
        // (FIREBASE_MIGRATION.md's crash-safety note) — the identity switch
        // already happened before the crash window closes, so this resumes
        // from the current, already-linked uid.
        resumePendingMergeIfNeeded().catch(() => {
          // Left for the next launch to retry, same as the migration above.
        });
      })
      .catch(() => {
        // Backgrounded on purpose: a failure here leaves the readiness flags
        // false and any skeleton showing, rather than crashing the boot path.
      });

    return () => {
      cancelled = true;
      detachCloudListeners();
    };
  }, []);

  return useCloudReady();
}
