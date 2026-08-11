import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "@react-native-firebase/firestore";

import { getFirebaseAuth, getFirebaseFirestore } from "@/services/firebase";
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
 * Fire-and-forget full-doc write for a brand-new or restored routine, called
 * from the store's `addRoutine`/`restoreRoutine` underneath their optimistic
 * local `set()`. No-ops before anonymous sign-in resolves, same as
 * `writeSettingsFields`.
 */
export function writeRoutine(routine: Routine): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(routineDocRef(uid, routine.id), routine).catch(() =>
    notifyCloudSyncFailure(),
  );
}

/** Fire-and-forget partial write, for `updateRoutine`. */
export function writeRoutineFields(
  id: string,
  fields: Record<string, unknown>,
): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(routineDocRef(uid, id), fields, { merge: true }).catch(() =>
    notifyCloudSyncFailure(),
  );
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
): Unsubscribe {
  return onSnapshot(routinesCollectionRef(uid), (snapshot) => {
    onData(snapshot.docs.map((d) => d.data() as Routine));
  });
}
