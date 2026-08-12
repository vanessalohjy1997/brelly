import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "@react-native-firebase/firestore";

import { getFirebaseAuth, getFirebaseFirestore } from "@/services/firebase";
import { groupSlotsIntoPlans, type CloudSlot } from "@/utils/planSelectors";
import { notifyCloudSyncFailure } from "@/utils/saveWithFeedback";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";

/**
 * `notificationId`/`notificationLeadMinutes` must never reach Firestore in
 * either direction — see `stripNotificationHandles`'s doc comment and
 * FIREBASE_MIGRATION.md's "Device-local fields must never sync". Every write
 * below excludes them unconditionally, rather than relying on each call site
 * to remember to strip.
 */
const DEVICE_LOCAL_FIELDS = new Set([
  "notificationId",
  "notificationLeadMinutes",
]);

/**
 * Payload for a full-doc (non-merge) write. Dropping an `undefined`-valued
 * key here is exactly equivalent to it being absent from the document that
 * results, since the whole doc is replaced.
 */
function toCloudDoc(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (DEVICE_LOCAL_FIELDS.has(key) || value === undefined) continue;
    result[key] = value;
  }
  return result;
}

/**
 * Payload for a partial merge write. Unlike a full-doc write, omitting a key
 * here leaves whatever Firestore already has for it untouched — so a field
 * the caller explicitly cleared to `undefined` (e.g. `SlotForm`'s
 * `notes: notes.trim() || undefined`) has to become `deleteField()`, or the
 * stale value survives in the cloud doc and comes right back on the next
 * snapshot.
 */
function toCloudMergeFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (DEVICE_LOCAL_FIELDS.has(key)) continue;
    result[key] = value === undefined ? deleteField() : value;
  }
  return result;
}

function slotDocRef(uid: string, id: string) {
  return doc(getFirebaseFirestore(), "users", uid, "slots", id);
}

function slotsCollectionRef(uid: string) {
  return collection(getFirebaseFirestore(), "users", uid, "slots");
}

function currentUid(): string | undefined {
  return getFirebaseAuth().currentUser?.uid;
}

/**
 * Fire-and-forget full-doc write for a brand-new, restored, or re-keyed slot
 * — called from the store's `addSlot`/`restoreSlot`/detach-rekey path
 * underneath their optimistic local `set()`. No-ops before anonymous sign-in
 * resolves, same as every other write in this app.
 */
export function writeSlot(slot: ItinerarySlot, date: string): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(slotDocRef(uid, slot.id), toCloudDoc({ ...slot, date })).catch(() =>
    notifyCloudSyncFailure(),
  );
}

/** Fire-and-forget partial write, for a non-detaching `updateSlot`. */
export function writeSlotFields(
  id: string,
  fields: Record<string, unknown>,
): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(slotDocRef(uid, id), toCloudMergeFields(fields), {
    merge: true,
  }).catch(() => notifyCloudSyncFailure());
}

export function deleteSlotDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(slotDocRef(uid, id)).catch(() => notifyCloudSyncFailure());
}

/**
 * Subscribes to the whole slots collection and hands the grouped `DayPlan[]`
 * to `onData` on every snapshot (cache or server). No knowledge of the
 * zustand store on purpose, same as `subscribeToSettingsDoc`/
 * `subscribeToRoutinesCollection`.
 */
export function subscribeToSlotsCollection(
  uid: string,
  onData: (plans: DayPlan[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    slotsCollectionRef(uid),
    (snapshot) => {
      const slots = snapshot.docs.map((d) => d.data() as CloudSlot);
      onData(groupSlotsIntoPlans(slots));
    },
    (error) => onError?.(error),
  );
}
