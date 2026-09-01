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
  ensureAnonymousUser,
  generateDocId,
  getFirebaseAuth,
  getFirebaseFirestore,
  linkCurrentUser,
  signInWithLinkedCredential,
  signOutCurrentUser,
} from "@/services/firebase";
import { migrationFlagKey } from "@/services/localDataMigration";
import { cancelAllNotifications } from "@/services/notifications";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { mmkvStorage } from "@/store/mmkvStorage";
import { useRoutineStore } from "@/store/routineStore";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/store/settingsStore";
import { allSlotsWithDates } from "@/utils/planSelectors";
import {
  resolveMergeWrites,
  type ExistingAccountIds,
  type LocalSnapshot,
} from "@/utils/mergeLocalIntoAccount";
import { authErrorCode } from "@/utils/describeAuthError";
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

/**
 * The "this identity already has its own account" signal, which Firebase
 * spells differently per provider: an OAuth credential rejects a link with
 * `auth/credential-already-in-use`, while an email/password one rejects it
 * with `auth/email-already-in-use`. Only matching the first is why the email
 * flow could never reach the merge — a second attempt with an address that
 * had already been linked surfaced as a flat "Couldn't back up your data".
 */
function isIdentityAlreadyInUse(error: unknown): boolean {
  const code = authErrorCode(error);
  return (
    code === "auth/credential-already-in-use" ||
    code === "auth/email-already-in-use" ||
    code === "auth/account-exists-with-different-credential"
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
    if (isIdentityAlreadyInUse(error)) return "merge-required";
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
  mmkvStorage.setItem(migrationFlagKey(newUid), "true");

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

  mmkvStorage.setItem(migrationFlagKey(anonUid), "true");
  clearPendingMerge();

  attachCloudListeners(anonUid);
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
