import type { PlatformCredential } from "@brelly/platform/auth";
import {
  ensureAnonymousUser,
  generateDocId,
  getFirebaseAuth,
  getFirebaseFirestore,
  signInWithLinkedCredential,
  signOutCurrentUser,
} from "@brelly/platform/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  onSnapshot,
  writeBatch,
} from "@brelly/platform/firestore";
import { cancelAllNotifications } from "@brelly/platform/notifications";
import { platformStorage } from "@brelly/platform/storage";

import { attachCloudListeners, detachCloudListeners } from "./cloudListeners";
import { useCloudSyncStore } from "../store/cloudSyncStore";
import { useItineraryStore } from "../store/itineraryStore";
import { useRoutineStore } from "../store/routineStore";
import { DEFAULT_SETTINGS, useSettingsStore } from "../store/settingsStore";
import type { ItinerarySlot } from "../types/itinerary";
import type { Routine } from "../types/routine";
import { migrationFlagKey } from "../utils/migrationFlagKey";
import {
  resolveMergeWrites,
  type ExistingAccountIds,
  type LocalSnapshot,
} from "../utils/mergeLocalIntoAccount";
import { omitUndefinedFields } from "../utils/omitUndefinedFields";
import { stripNotificationHandles } from "../utils/stripNotificationHandles";

/** Firestore's own per-batch cap is 500; chunking below it leaves headroom —
 * same rationale as `localDataMigration.ts`'s constant of the same name. */
const MAX_BATCH_WRITES = 400;

// The string is unchanged from when this was an MMKV-only constant: it is a
// key in storage on devices already out there, and renaming it would strand
// any merge that was interrupted across the update.
const PENDING_MERGE_STORAGE_KEY = "brelly-pending-merge";

/**
 * The record that makes the delete survivable.
 *
 * It used to be the snapshot alone, written only when the user chose to add
 * their data to the account they were joining. That left the *"Don't add"*
 * branch running the delete with no crash-recovery record at all, and the
 * `try/catch` around the sign-in cannot help there: it compensates for a
 * *rejected* sign-in, not for the process ending. On a phone the window is
 * narrow. A browser tab gets closed mid-flow all the time.
 *
 * So the record carries three things now and is written before *every* delete.
 * `anonUid` is what lets a resume know whether the documents it is holding
 * belong to the account it has woken up as; `addLocalData` is the only part
 * that was ever conditional, and it is now data rather than the difference
 * between writing a record and not writing one.
 */
type PendingMerge = {
  anonUid: string;
  snapshot: LocalSnapshot;
  addLocalData: boolean;
};

/**
 * Throws rather than returning a failure, and the caller must let it abort the
 * merge before anything is deleted.
 *
 * MMKV never throws. `localStorage.setItem` throws `QuotaExceededError` in
 * Safari's private mode, which is exactly the situation where losing the
 * record matters — a delete with no record is the thing this record exists to
 * prevent, so refusing to start is the only safe answer.
 */
function persistPendingMerge(pending: PendingMerge): void {
  platformStorage.setItem(PENDING_MERGE_STORAGE_KEY, JSON.stringify(pending));
}

function clearPendingMerge(): void {
  platformStorage.removeItem(PENDING_MERGE_STORAGE_KEY);
}

function readPendingMerge(): PendingMerge | null {
  const raw = platformStorage.getItem(PENDING_MERGE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingMerge>;
    // A record written before the shape widened has no `anonUid`. There is
    // nothing to check it against, so it can only be treated as the old
    // "payload for a merge that already switched identity" case.
    if (!parsed || !parsed.snapshot) return null;
    return {
      anonUid: parsed.anonUid ?? "",
      snapshot: parsed.snapshot,
      addLocalData: parsed.addLocalData ?? true,
    };
  } catch {
    return null;
  }
}

function isSnapshotEmpty(snapshot: LocalSnapshot): boolean {
  return snapshot.slots.length === 0 && snapshot.routines.length === 0;
}

/**
 * Everything the anonymous account holds in Firestore, read from the server.
 *
 * This replaced a read of the local Zustand stores, and the difference is the
 * whole point. The stores are a *mirror* of these documents, populated by
 * `onSnapshot` after the app boots. A web tab that starts a merge before the
 * listeners have hydrated has empty stores and a full account — and the value
 * read here decides what gets deleted, so reading the mirror silently orphans
 * every document the merge was supposed to move.
 *
 * `getDocsFromServer`, not `getDocs`: an offline client answering out of its
 * own cache would report "nothing here" with complete confidence, which is the
 * same failure wearing a different hat. Failing loudly is correct — there is
 * no safe way to delete an account's contents without having seen them.
 *
 * Must run *before* the identity switch. `firestore.rules` gates reads on
 * `request.auth.uid == <path uid>`, so once the session is the target account
 * this read is `permission-denied`. It is deliberately a different read from
 * the target-account one inside `writeMergeSnapshot`, which is post-switch and
 * only needs ids.
 *
 * Settings are excluded, per FIREBASE_MIGRATION.md's "Account linking" step 8:
 * settings never merge. The settings document is still deleted from the
 * anonymous uid, and deliberately not restored on failure — it holds scalar
 * preferences the local store still has and rewrites on the next change.
 */
export async function readAnonymousData(): Promise<
  LocalSnapshot & { isEmpty: boolean }
> {
  const anonUid = getFirebaseAuth().currentUser?.uid;
  if (!anonUid) throw new Error("No anonymous user to merge from");

  const db = getFirebaseFirestore();

  const [slotDocs, routineDocs] = await Promise.all([
    getDocsFromServer(collection(db, "users", anonUid, "slots")),
    getDocsFromServer(collection(db, "users", anonUid, "routines")),
  ]);

  const slots = slotDocs.docs.map((d) => {
    const { date, ...slot } = (d.data() ?? {}) as ItinerarySlot & {
      date: string;
    };
    return { date, slot: { ...slot, id: d.id } as ItinerarySlot };
  });
  const routines = routineDocs.docs.map(
    (d) => ({ ...(d.data() ?? {}), id: d.id }) as Routine,
  );

  const snapshot = { slots, routines };
  return { ...snapshot, isEmpty: isSnapshotEmpty(snapshot) };
}

// Requirement 1's happy path and requirement 2's trigger used to live here as
// `linkAnonymousAccount`. They are now `linkProvider` in
// `@brelly/platform/auth`, because acquiring a credential and linking it are
// one indivisible step on the web — `signInWithPopup` *is* the sign-in — and
// the error codes that distinguish "already has an account" from a real
// failure are the SDK's vocabulary rather than core's. What is left here is
// what happens *after* that answer comes back, which is the part both
// platforms share.

/** Chunked `writeBatch()` deletes of everything under the anonymous uid —
 * the doc's step 4: the only chance to avoid orphaned data, since these
 * become unreachable the instant the session switches identity. */
async function deleteAnonymousUserData(
  anonUid: string,
  snapshot: LocalSnapshot,
): Promise<void> {
  const db = getFirebaseFirestore();
  const commits: Promise<void>[] = [];

  const slotIds = snapshot.slots.map(({ slot }) => slot.id);
  for (let i = 0; i < slotIds.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const id of slotIds.slice(i, i + MAX_BATCH_WRITES)) {
      batch.delete(doc(db, "users", anonUid, "slots", id));
    }
    commits.push(batch.commit());
  }

  const routineIds = snapshot.routines.map((routine) => routine.id);
  for (let i = 0; i < routineIds.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const id of routineIds.slice(i, i + MAX_BATCH_WRITES)) {
      batch.delete(doc(db, "users", anonUid, "routines", id));
    }
    commits.push(batch.commit());
  }

  commits.push(deleteDoc(doc(db, "users", anonUid, "settings", "app")));

  await Promise.all(commits);
}

/** The ids already present in the target account's collections — read once,
 * not subscribed, since this is a point-in-time check for the collision
 * resolution in `resolveMergeWrites`. */
function readExistingIds(uid: string): Promise<ExistingAccountIds> {
  const db = getFirebaseFirestore();

  // The unsubscribe is deferred to a microtask rather than called inline:
  // the real SDK's first delivery is always asynchronous, but the test
  // double's is synchronous, which would otherwise call `unsubscribe`
  // before this statement finishes assigning it.
  const readOnce = (path: string): Promise<string[]> =>
    new Promise((resolve) => {
      const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
        resolve(snapshot.docs.map((d) => d.id));
        Promise.resolve().then(() => unsubscribe());
      });
    });

  return Promise.all([
    readOnce(`users/${uid}/slots`),
    readOnce(`users/${uid}/routines`),
  ]).then(([slotIds, routineIds]) => ({
    slotIds: new Set(slotIds),
    routineIds: new Set(routineIds),
  }));
}

/**
 * Writes the local snapshot into `uid`'s collections, minting fresh ids on
 * any collision with what's already there — step 7. Shared between the
 * interactive merge and `resumePendingMergeIfNeeded`, since both end up
 * doing exactly this once the target uid is known.
 */
async function writeMergeSnapshot(
  uid: string,
  snapshot: LocalSnapshot,
): Promise<void> {
  if (isSnapshotEmpty(snapshot)) return;

  const existing = await readExistingIds(uid);
  const writes = resolveMergeWrites(snapshot, existing, generateDocId);

  const db = getFirebaseFirestore();
  const commits: Promise<void>[] = [];

  for (let i = 0; i < writes.slots.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const { date, slot } of writes.slots.slice(i, i + MAX_BATCH_WRITES)) {
      // Crossing an account boundary, same as the local→cloud migration and
      // the backup import — see `stripNotificationHandles`'s doc comment for
      // what carrying a device-local handle onto another account costs.
      batch.set(
        doc(db, "users", uid, "slots", slot.id),
        omitUndefinedFields({ ...stripNotificationHandles(slot), date }),
      );
    }
    commits.push(batch.commit());
  }

  for (let i = 0; i < writes.routines.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const routine of writes.routines.slice(i, i + MAX_BATCH_WRITES)) {
      batch.set(
        doc(db, "users", uid, "routines", routine.id),
        omitUndefinedFields(routine),
      );
    }
    commits.push(batch.commit());
  }

  await Promise.all(commits);
}

/**
 * Requirement 2's merge, once `linkAnonymousAccount` has signalled
 * `"merge-required"`. `snapshot` is both what gets deleted from the
 * anonymous uid (its live mirror of that uid's own Firestore data) and,
 * when `addLocalData` is true, what gets written into the account just
 * joined.
 *
 * Not atomic — it spans two auth identities, so it can't be. The pending
 * snapshot is persisted to MMKV before anything destructive happens and
 * cleared only once everything has committed, so `resumePendingMergeIfNeeded`
 * can finish an interrupted merge on the next launch.
 */
export async function mergeIntoExistingAccount(
  credential: PlatformCredential,
  snapshot: LocalSnapshot,
  addLocalData: boolean,
): Promise<void> {
  const anonUid = getFirebaseAuth().currentUser?.uid;
  if (!anonUid) throw new Error("No anonymous user to merge from");

  // Before every delete, not only before a delete that will be followed by a
  // write. What is about to happen is destructive either way, and the record
  // is the only thing that can undo it across a process that does not come
  // back. Allowed to throw: a storage that cannot hold the record is a reason
  // not to start, not a reason to proceed without one.
  persistPendingMerge({ anonUid, snapshot, addLocalData });

  await deleteAnonymousUserData(anonUid, snapshot);

  // An OAuth credential is already proven by the provider's own sheet before
  // it reaches here, so the switch cannot fail on a bad secret. An email
  // credential is unverified until it is used: a wrong password fails *after*
  // the anonymous uid's documents are gone, with the session still anonymous
  // and no identity to switch to. Put them back before rethrowing — the ids
  // are reused verbatim, so this restores the account rather than duplicating
  // it. (The settings doc is not restored: it holds only scalar preferences,
  // which the local store still has and rewrites on the next change.)
  try {
    await signInWithLinkedCredential(credential);
  } catch (error) {
    await writeMergeSnapshot(anonUid, snapshot);
    clearPendingMerge();
    throw error;
  }

  const newUid = getFirebaseAuth().currentUser?.uid;
  if (!newUid) throw new Error("Sign-in did not resolve a uid");

  // Set before anything else post-switch: without it, a crash right here
  // would leave the next boot's ordinary migration re-uploading this
  // device's frozen pre-migration MMKV blobs into the account just joined —
  // see FIREBASE_MIGRATION.md's "One exception, and it is a real hazard".
  platformStorage.setItem(migrationFlagKey(newUid), "true");

  useCloudSyncStore.getState().resetReady();
  detachCloudListeners();

  if (addLocalData) await writeMergeSnapshot(newUid, snapshot);

  attachCloudListeners(newUid);
  clearPendingMerge();
}

/**
 * Leaves the linked account and lands back on a fresh anonymous one — the
 * state a brand-new install is in.
 *
 * Nothing is deleted from the account being left; it keeps every document,
 * and signing back in with the same credential brings all of it back through
 * the ordinary listeners. What has to happen here is the other direction:
 * this device must stop holding the account's data.
 *
 * The order is load-bearing.
 *
 * - Listeners come down first, or the next `setState` would race a snapshot
 *   from the account being left and put its plans back.
 * - The OS notification queue is cleared while the handles still mean
 *   something. It is best-effort: a stray alert is worth less than a
 *   sign-out that refuses to complete.
 * - The stores are emptied via `setState`, not through their actions, for
 *   the same reason `cloudListeners` does — an action would write to
 *   Firestore, and deleting the account's data is exactly what sign-out must
 *   not do.
 * - The migration flag is set for the *new* anonymous uid before anything
 *   can boot against it. Without it the next cold start's ordinary migration
 *   re-uploads this device's frozen pre-migration MMKV blobs into the empty
 *   account — the same hazard `mergeIntoExistingAccount` guards, and worse
 *   here, because the whole point of signing out is to leave nothing behind.
 */
export async function signOutOfAccount(): Promise<void> {
  detachCloudListeners();
  useCloudSyncStore.getState().resetReady();

  await cancelAllNotifications().catch(() => {
    // best-effort — see the doc comment above
  });

  await signOutCurrentUser();

  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useSettingsStore.setState({ ...DEFAULT_SETTINGS });

  await ensureAnonymousUser();
  const anonUid = getFirebaseAuth().currentUser?.uid;
  if (!anonUid) throw new Error("Sign-out did not resolve a new anonymous uid");

  platformStorage.setItem(migrationFlagKey(anonUid), "true");
  clearPendingMerge();

  attachCloudListeners(anonUid);
}

/**
 * Called once from `useCloudBootstrap`'s boot effect. A no-op on every
 * ordinary launch — it only does something when a previous session died
 * somewhere in the middle of `mergeIntoExistingAccount`, which is not atomic
 * and cannot be: it spans two auth identities.
 *
 * Three cases, and the middle one is the one that used to be missing.
 *
 * | state on this launch                | what it means                                  | action                          |
 * | ----------------------------------- | ---------------------------------------------- | ------------------------------- |
 * | signed in, not anonymous            | the switch completed; the merge write may not  | write into the target, clear    |
 * | anonymous, uid matches `anonUid`    | the delete ran; the switch never happened      | restore under the same ids      |
 * | anonymous, uid differs              | this record is not about this session           | leave it alone                  |
 *
 * The old code bailed on `user.isAnonymous` and left the record pending
 * "rather than guessing". That was right while the record held only a payload
 * for a merge that had already switched identity. It is wrong now that the
 * record is also written before a delete, because the documents the delete
 * removed are sitting in the record with nobody coming back for them.
 * Restoring them to the same uid under the same ids is not a guess — it is the
 * same undo the sign-in `catch` performs, a launch later.
 *
 * The third case is not caution for its own sake: `firestore.rules` would
 * reject the write anyway, since the session is not the owner of `anonUid`.
 */
export async function resumePendingMergeIfNeeded(): Promise<void> {
  const pending = readPendingMerge();
  if (!pending) return;

  const user = getFirebaseAuth().currentUser;
  if (!user) return;

  if (user.isAnonymous) {
    if (!pending.anonUid || user.uid !== pending.anonUid) return;
    await writeMergeSnapshot(pending.anonUid, pending.snapshot);
    clearPendingMerge();
    return;
  }

  platformStorage.setItem(migrationFlagKey(user.uid), "true");
  if (pending.addLocalData) {
    await writeMergeSnapshot(user.uid, pending.snapshot);
  }
  clearPendingMerge();
}
