import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "@react-native-firebase/firestore";

import { getFirebaseAuth, getFirebaseFirestore } from "@/services/firebase";
import { omitUndefinedFields } from "@/utils/omitUndefinedFields";
import { notifyCloudSyncFailure } from "@/utils/saveWithFeedback";
import type { Routine } from "@/types/routine";

function routineDocRef(uid: string, id: string) {
  return doc(getFirebaseFirestore(), "users", uid, "routines", id);
}

function routinesCollectionRef(uid: string) {
  return collection(getFirebaseFirestore(), "users", uid, "routines");
}

function currentUid(): string | undefined {
  return getFirebaseAuth().currentUser?.uid;
}

/**
 * Payload for a partial merge write — mirrors `itinerarySync.ts`'s
 * `toCloudMergeFields`. Omitting a key here leaves whatever Firestore already
 * has for it untouched, so a field the caller explicitly cleared to
 * `undefined` (e.g. removing a routine's end date to make it run
 * indefinitely again) has to become `deleteField()`, or the stale value
 * survives in the cloud doc and comes right back on the next snapshot.
 */
function toCloudMergeFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = value === undefined ? deleteField() : value;
  }
  return result;
}

/**
 * Fire-and-forget full-doc write for a brand-new or restored routine, called
 * from the store's `addRoutine`/`restoreRoutine` underneath their optimistic
 * local `set()`. No-ops before anonymous sign-in resolves, same as
 * `writeSettingsFields`. `omitUndefinedFields` matters here specifically
 * because a routine with no end date is built with `endDate: undefined`
 * (see `plan/new.tsx`) — Firestore rejects a literal `undefined` outright.
 */
export function writeRoutine(routine: Routine): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(routineDocRef(uid, routine.id), omitUndefinedFields(routine)).catch(
    () => notifyCloudSyncFailure(),
  );
}

/** Fire-and-forget partial write, for `updateRoutine`. */
export function writeRoutineFields(
  id: string,
  fields: Record<string, unknown>,
): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(routineDocRef(uid, id), toCloudMergeFields(fields), {
    merge: true,
  }).catch(() => notifyCloudSyncFailure());
}

export function deleteRoutineDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(routineDocRef(uid, id)).catch(() => notifyCloudSyncFailure());
}

/**
 * `arrayUnion`/`arrayRemove` rather than a full-doc rewrite — see
 * FIREBASE_MIGRATION.md's "multi-device is the goal": two devices adding or
 * lifting exceptions on the same routine must merge, not clobber each other.
 */
export function addExceptionField(id: string, date: string): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(
    routineDocRef(uid, id),
    { exceptions: arrayUnion(date) },
    { merge: true },
  ).catch(() => notifyCloudSyncFailure());
}

export function removeExceptionField(id: string, date: string): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(
    routineDocRef(uid, id),
    { exceptions: arrayRemove(date) },
    { merge: true },
  ).catch(() => notifyCloudSyncFailure());
}

/**
 * Subscribes to the whole routines collection and hands the plain array of
 * routines to `onData` on every snapshot (cache or server). No knowledge of
 * the zustand store on purpose, same as `subscribeToSettingsDoc`.
 */
export function subscribeToRoutinesCollection(
  uid: string,
  onData: (routines: Routine[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    routinesCollectionRef(uid),
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as Routine));
    },
    (error) => onError?.(error),
  );
}
