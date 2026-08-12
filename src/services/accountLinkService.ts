import type { AuthCredential } from "@react-native-firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
} from "@react-native-firebase/firestore";

import { attachCloudListeners, detachCloudListeners } from "@/services/cloudListeners";
import {
  generateDocId,
  getFirebaseAuth,
  getFirebaseFirestore,
  linkCurrentUser,
  signInWithLinkedCredential,
} from "@/services/firebase";
import { migrationFlagKey } from "@/services/localDataMigration";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { mmkvStorage } from "@/store/mmkvStorage";
import { useRoutineStore } from "@/store/routineStore";
import { allSlotsWithDates } from "@/utils/planSelectors";
import {
  resolveMergeWrites,
  type ExistingAccountIds,
  type LocalSnapshot,
} from "@/utils/mergeLocalIntoAccount";
import { omitUndefinedFields } from "@/utils/omitUndefinedFields";
import { stripNotificationHandles } from "@/utils/stripNotificationHandles";

/** Firestore's own per-batch cap is 500; chunking below it leaves headroom —
 * same rationale as `localDataMigration.ts`'s constant of the same name. */
const MAX_BATCH_WRITES = 400;

const MERGE_SNAPSHOT_MMKV_KEY = "brelly-pending-merge";

function persistPendingMerge(snapshot: LocalSnapshot): void {
  mmkvStorage.setItem(MERGE_SNAPSHOT_MMKV_KEY, JSON.stringify(snapshot));
}

function clearPendingMerge(): void {
  mmkvStorage.removeItem(MERGE_SNAPSHOT_MMKV_KEY);
}

function readPendingMerge(): LocalSnapshot | null {
  const raw = mmkvStorage.getItem(MERGE_SNAPSHOT_MMKV_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalSnapshot;
  } catch {
    return null;
  }
}

function isSnapshotEmpty(snapshot: LocalSnapshot): boolean {
  return snapshot.slots.length === 0 && snapshot.routines.length === 0;
}

/**
 * Reads the local Zustand stores — not MMKV, which after phase 2–4 holds only
 * the frozen pre-migration blobs. Settings are excluded: per
 * FIREBASE_MIGRATION.md's "Account linking" step 8, settings never merge.
 */
export function snapshotLocalData(): LocalSnapshot & { isEmpty: boolean } {
  const slots = allSlotsWithDates(useItineraryStore.getState().plans);
  const routines = useRoutineStore.getState().routines;
  const snapshot = { slots, routines };
  return { ...snapshot, isEmpty: isSnapshotEmpty(snapshot) };
}

function isCredentialAlreadyInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "auth/credential-already-in-use"
  );
}

/**
 * Requirement 1's happy path and requirement 2's trigger, in one call — see
 * FIREBASE_MIGRATION.md's "Account linking". A brand-new identity links onto
 * the current uid with nothing else to do; an identity that already has an
 * account throws `auth/credential-already-in-use`, which is the signal to
 * run `mergeIntoExistingAccount`, not an error to surface.
 */
export async function linkAnonymousAccount(
  credential: AuthCredential,
): Promise<"linked" | "merge-required"> {
  try {
    await linkCurrentUser(credential);
    return "linked";
  } catch (error) {
    if (isCredentialAlreadyInUse(error)) return "merge-required";
    throw error;
  }
}

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
  credential: AuthCredential,
  snapshot: LocalSnapshot,
  addLocalData: boolean,
): Promise<void> {
  const anonUid = getFirebaseAuth().currentUser?.uid;
  if (!anonUid) throw new Error("No anonymous user to merge from");

  if (addLocalData && !isSnapshotEmpty(snapshot)) {
    persistPendingMerge(snapshot);
  }

  await deleteAnonymousUserData(anonUid, snapshot);
  await signInWithLinkedCredential(credential);

  const newUid = getFirebaseAuth().currentUser?.uid;
  if (!newUid) throw new Error("Sign-in did not resolve a uid");

  // Set before anything else post-switch: without it, a crash right here
  // would leave the next boot's ordinary migration re-uploading this
  // device's frozen pre-migration MMKV blobs into the account just joined —
  // see FIREBASE_MIGRATION.md's "One exception, and it is a real hazard".
  mmkvStorage.setItem(migrationFlagKey(newUid), "true");

  useCloudSyncStore.getState().resetReady();
  detachCloudListeners();

  if (addLocalData) await writeMergeSnapshot(newUid, snapshot);

  attachCloudListeners(newUid);
  clearPendingMerge();
}

/**
 * Called once from `useCloudBootstrap`'s boot effect. A no-op on every
 * ordinary launch — it only does something when a previous session was
 * killed after `mergeIntoExistingAccount` had already switched identity but
 * before it finished writing the merge, leaving a pending snapshot in MMKV.
 *
 * If the current user is still anonymous, the identity switch itself never
 * completed — there's no credential left to retry it with, so this leaves
 * the pending snapshot in place rather than guessing.
 */
export async function resumePendingMergeIfNeeded(): Promise<void> {
  const snapshot = readPendingMerge();
  if (!snapshot) return;

  const user = getFirebaseAuth().currentUser;
  if (!user || user.isAnonymous) return;

  mmkvStorage.setItem(migrationFlagKey(user.uid), "true");
  await writeMergeSnapshot(user.uid, snapshot);
  clearPendingMerge();
}
