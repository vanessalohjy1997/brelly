import {
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "@react-native-firebase/firestore";

import { getFirebaseAuth, getFirebaseFirestore } from "@/services/firebase";
import { notifyCloudSyncFailure } from "@/utils/saveWithFeedback";
import {
  migrateSettingsDoc,
  SETTINGS_SCHEMA_VERSION,
} from "@/utils/migrateSettingsDoc";

function settingsDocRef(uid: string) {
  return doc(getFirebaseFirestore(), "users", uid, "settings", "app");
}

/**
 * Fire-and-forget partial write for a settings field change, called from the
 * store's setters underneath their optimistic local `set()`. No-ops before
 * anonymous sign-in resolves — by the time a user can press a switch that
 * should already have happened, but a missing uid is a safe no-op rather
 * than a write to nowhere.
 */
export function writeSettingsFields(fields: Record<string, unknown>): void {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return;
  setDoc(
    settingsDocRef(uid),
    { ...fields, schemaVersion: SETTINGS_SCHEMA_VERSION },
    { merge: true },
  ).catch(() => notifyCloudSyncFailure());
}

/**
 * Subscribes to the settings doc and hands the migrated, plain-object result
 * to `onData` on every snapshot (cache or server — never gated on the
 * network). This file has no knowledge of the zustand store on purpose;
 * `useCloudBootstrap` is what applies the result via `setState`.
 */
export function subscribeToSettingsDoc(
  uid: string,
  onData: (fields: Record<string, unknown>) => void,
): Unsubscribe {
  return onSnapshot(settingsDocRef(uid), (snapshot) => {
    const raw = snapshot.data() as Record<string, unknown> | undefined;
    const schemaVersion =
      typeof raw?.schemaVersion === "number"
        ? raw.schemaVersion
        : SETTINGS_SCHEMA_VERSION;
    onData(migrateSettingsDoc(raw, schemaVersion));
  });
}
