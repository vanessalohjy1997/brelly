import { useEffect } from "react";

import { resumePendingMergeIfNeeded } from "@/services/accountLinkService";
import { attachCloudListeners, detachCloudListeners } from "@/services/cloudListeners";
import { ensureAnonymousUser, getFirebaseAuth } from "@/services/firebase";
import {
  confirmLocalDataMigration,
  enqueueLocalDataMigration,
} from "@/services/localDataMigration";
import {
  describeCloudSyncError,
  useCloudReady,
  useCloudSyncStore,
} from "@/store/cloudSyncStore";

/**
 * `isCancelled` lets the mount-effect call abort after its own unmount —
 * React's dev-mode double-invoke (and Fast Refresh remounts) can otherwise
 * leave two overlapping bootstrap attempts in flight, each independently
 * enqueueing the same local→cloud migration write. `retryCloudBootstrap`'s
 * one-shot call has nothing to abort into, so it doesn't pass one.
 */
async function runBootstrap(isCancelled: () => boolean = () => false): Promise<void> {
  try {
    await ensureAnonymousUser();
    if (isCancelled()) return;
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

    useCloudSyncStore.getState().setBootstrapError(null);
  } catch (error) {
    // Backgrounded on purpose: a failure here leaves the readiness flags
    // false rather than crashing the boot path — but it's surfaced through
    // `bootstrapError` so a skeleton screen can show it instead of spinning
    // forever with no explanation.
    console.error("[useCloudBootstrap] bootstrap failed", error);
    if (!isCancelled()) {
      useCloudSyncStore.getState().setBootstrapError(describeCloudSyncError());
    }
  }
}

/** Re-runs sign-in and listener attachment — the action behind a skeleton
 * screen's "Try again" once `useCloudBootstrapError()` is set. */
export function retryCloudBootstrap(): void {
  useCloudSyncStore.getState().setBootstrapError(null);
  void runBootstrap();
}

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
    void runBootstrap(() => cancelled);

    return () => {
      cancelled = true;
      detachCloudListeners();
    };
  }, []);

  return useCloudReady();
}
