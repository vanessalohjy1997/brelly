import { doc, setDoc, writeBatch } from "@react-native-firebase/firestore";

import { getFirebaseFirestore } from "@/services/firebase";
import { mmkvStorage } from "@/store/mmkvStorage";
import type { DayPlan } from "@/types/itinerary";
import type { Routine } from "@/types/routine";
import { allSlotsWithDates } from "@/utils/planSelectors";
import {
  migrateSettingsDoc,
  SETTINGS_SCHEMA_VERSION,
  toCloudSettingsFields,
} from "@/utils/migrateSettingsDoc";
import { stripNotificationHandles } from "@/utils/stripNotificationHandles";

const SETTINGS_MMKV_KEY = "brelly-settings";
const ROUTINES_MMKV_KEY = "brelly-routines";
const ITINERARY_MMKV_KEY = "brelly-itinerary";

/** Firestore's own per-batch cap is 500; chunking below it leaves headroom. */
const MAX_BATCH_WRITES = 400;

function migrationFlagKey(uid: string): string {
  return `brelly-migration-complete:${uid}`;
}

function settingsDocRef(uid: string) {
  return doc(getFirebaseFirestore(), "users", uid, "settings", "app");
}

function routineDocRef(uid: string, id: string) {
  return doc(getFirebaseFirestore(), "users", uid, "routines", id);
}

function slotDocRef(uid: string, id: string) {
  return doc(getFirebaseFirestore(), "users", uid, "slots", id);
}

function enqueueSettingsMigration(uid: string): Promise<void> | null {
  const raw = mmkvStorage.getItem(SETTINGS_MMKV_KEY);
  if (!raw) return null;

  let persisted: { state?: Record<string, unknown>; version?: number };
  try {
    persisted = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!persisted.state) return null;

  const migrated = migrateSettingsDoc(
    persisted.state,
    persisted.version ?? SETTINGS_SCHEMA_VERSION,
  );

  return setDoc(
    settingsDocRef(uid),
    { ...toCloudSettingsFields(migrated), schemaVersion: SETTINGS_SCHEMA_VERSION },
    { merge: true },
  );
}

/**
 * Writes every locally-persisted routine to its own doc, chunked to
 * `MAX_BATCH_WRITES` per `writeBatch()` — a routine list is nowhere near that
 * size today, but the chunking is the same shape phase 4's larger slots
 * collection needs, so it is not worth a second code path later.
 */
function enqueueRoutinesMigration(uid: string): Promise<void> | null {
  const raw = mmkvStorage.getItem(ROUTINES_MMKV_KEY);
  if (!raw) return null;

  let persisted: { state?: { routines?: Routine[] } };
  try {
    persisted = JSON.parse(raw);
  } catch {
    return null;
  }
  const routines = persisted.state?.routines;
  if (!routines || routines.length === 0) return null;

  const commits: Promise<void>[] = [];
  for (let i = 0; i < routines.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(getFirebaseFirestore());
    for (const routine of routines.slice(i, i + MAX_BATCH_WRITES)) {
      batch.set(routineDocRef(uid, routine.id), routine);
    }
    commits.push(batch.commit());
  }
  return Promise.all(commits).then(() => undefined);
}

/**
 * Writes every locally-persisted itinerary slot to its own doc, flattened out
 * of `DayPlan.slots` and stripped of device-local notification handles — see
 * `stripNotificationHandles`'s doc comment for why a slot arriving on another
 * device with a foreign `notificationId` would leave its rain alert
 * permanently un-schedulable. Chunked the same way `enqueueRoutinesMigration`
 * is; a routine can generate ~260 archived slots/year (see `NOTES.md`), so
 * long-lived installs need it here more than anywhere else.
 */
function enqueueSlotsMigration(uid: string): Promise<void> | null {
  const raw = mmkvStorage.getItem(ITINERARY_MMKV_KEY);
  if (!raw) return null;

  let persisted: { state?: { plans?: DayPlan[] } };
  try {
    persisted = JSON.parse(raw);
  } catch {
    return null;
  }
  const plans = persisted.state?.plans;
  if (!plans || plans.length === 0) return null;

  const slots = allSlotsWithDates(plans);
  if (slots.length === 0) return null;

  const commits: Promise<void>[] = [];
  for (let i = 0; i < slots.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(getFirebaseFirestore());
    for (const { date, slot } of slots.slice(i, i + MAX_BATCH_WRITES)) {
      batch.set(slotDocRef(uid, slot.id), {
        ...stripNotificationHandles(slot),
        date,
      });
    }
    commits.push(batch.commit());
  }
  return Promise.all(commits).then(() => undefined);
}

/**
 * Enqueues every store's slice of the one-time local→cloud migration and
 * returns a single commit promise *without* awaiting it — Firestore applies
 * each write to its local cache synchronously regardless of network, so the
 * boot path must not block on server ack (see FIREBASE_MIGRATION.md's
 * "enqueue/confirm split"). Returns `null` when there is nothing to do:
 * already migrated, or no local data ever existed for any store.
 */
export function enqueueLocalDataMigration(uid: string): Promise<void> | null {
  if (mmkvStorage.getItem(migrationFlagKey(uid))) return null;

  const commits = [
    enqueueSettingsMigration(uid),
    enqueueRoutinesMigration(uid),
    enqueueSlotsMigration(uid),
  ].filter((commit): commit is Promise<void> => commit !== null);

  if (commits.length === 0) return null;
  return Promise.all(commits).then(() => undefined);
}

/**
 * The confirmation half — off the boot path. On success the local flag is
 * set so this doesn't re-run; on failure it's left unset and retried next
 * launch, which is safe because re-uploading is a same-doc-id overwrite, not
 * a duplicate.
 */
export function confirmLocalDataMigration(
  uid: string,
  commit: Promise<void>,
): void {
  commit
    .then(() => mmkvStorage.setItem(migrationFlagKey(uid), "true"))
    .catch(() => {
      // Left unset on purpose so the next launch retries.
    });
}
