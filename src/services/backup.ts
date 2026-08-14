import { doc, writeBatch } from "@react-native-firebase/firestore";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { getFirebaseAuth, getFirebaseFirestore } from "@/services/firebase";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { useSettingsStore } from "@/store/settingsStore";
import { omitUndefinedFields } from "@/utils/omitUndefinedFields";
import { notifyCloudSyncFailure } from "@/utils/saveWithFeedback";
import { stripNotificationHandles } from "@/utils/stripNotificationHandles";
import type { DayPlan } from "@/types/itinerary";
import type { Routine } from "@/types/routine";

/** Firestore's own per-batch cap is 500; chunking below it leaves headroom —
 * same rationale as `localDataMigration.ts`'s constant of the same name. */
const MAX_BATCH_WRITES = 400;

/**
 * Batches the import's Firestore side explicitly via chunked `writeBatch()`,
 * on top of — not instead of — each `restoreSlot`/`restoreRoutine` call's own
 * individual write below. The two are redundant (same final doc state, so
 * harmless), but the explicit batch is what gives a large import atomicity
 * within each chunk, which individual fire-and-forget writes don't. No-ops
 * before a uid exists, same as every other write path in this app.
 */
function batchWriteImportedData(plans: DayPlan[], routines: Routine[]): void {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return;

  const db = getFirebaseFirestore();
  const commits: Promise<void>[] = [];

  const slots = plans.flatMap((plan) =>
    plan.slots.map((slot) => ({ ...stripNotificationHandles(slot), date: plan.date })),
  );
  for (let i = 0; i < slots.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const slot of slots.slice(i, i + MAX_BATCH_WRITES)) {
      batch.set(doc(db, "users", uid, "slots", slot.id), omitUndefinedFields(slot));
    }
    commits.push(batch.commit());
  }

  for (let i = 0; i < routines.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    for (const routine of routines.slice(i, i + MAX_BATCH_WRITES)) {
      batch.set(
        doc(db, "users", uid, "routines", routine.id),
        omitUndefinedFields(routine),
      );
    }
    commits.push(batch.commit());
  }

  Promise.all(commits).catch(() => notifyCloudSyncFailure());
}

export type BackupData = {
  version: 1;
  exportedAt: string;
  itinerary: { plans: ReturnType<typeof useItineraryStore.getState>["plans"] };
  routines: { routines: ReturnType<typeof useRoutineStore.getState>["routines"] };
  settings: {
    themePreference: ReturnType<typeof useSettingsStore.getState>["themePreference"];
    rainAlertsEnabled: ReturnType<typeof useSettingsStore.getState>["rainAlertsEnabled"];
    rainLeadMinutes: ReturnType<typeof useSettingsStore.getState>["rainLeadMinutes"];
    quietHours: ReturnType<typeof useSettingsStore.getState>["quietHours"];
    digest: ReturnType<typeof useSettingsStore.getState>["digest"];
  };
};

export async function exportBackup(): Promise<void> {
  const itinerary = useItineraryStore.getState();
  const routines = useRoutineStore.getState();
  const settings = useSettingsStore.getState();

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    itinerary: {
      // A backup outlives the device that wrote it — that is the entire point
      // of one — so the per-device notification bookkeeping must not travel
      // with it. See `stripNotificationHandles` for what carrying it costs.
      plans: itinerary.plans.map((plan) => ({
        ...plan,
        slots: plan.slots.map(stripNotificationHandles),
      })),
    },
    routines: { routines: routines.routines },
    settings: {
      themePreference: settings.themePreference,
      rainAlertsEnabled: settings.rainAlertsEnabled,
      rainLeadMinutes: settings.rainLeadMinutes,
      quietHours: settings.quietHours,
      digest: settings.digest,
    },
  };

  const file = new File(Paths.cache, "brelly-backup.json");
  file.write(JSON.stringify(backup, null, 2));
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Export Brelly backup",
  });
}

export async function importBackup(uri: string): Promise<{
  plans: number;
  routines: number;
}> {
  const file = new File(uri);
  const content = await file.text();
  const data = JSON.parse(content) as BackupData;

  if (!data.version || !data.itinerary || !data.routines) {
    throw new Error("Not a valid Brelly backup file");
  }

  const { plans } = data.itinerary;
  const { routines } = data.routines;

  if (!Array.isArray(plans) || !Array.isArray(routines)) {
    throw new Error("Not a valid Brelly backup file");
  }

  batchWriteImportedData(plans, routines);

  const itineraryStore = useItineraryStore.getState();
  const routineStore = useRoutineStore.getState();

  for (const plan of plans) {
    for (const slot of plan.slots) {
      // Stripped on the way in as well as on the way out: files written before
      // the export learned to strip are already out there, and this is the
      // only place they can be cleaned up.
      itineraryStore.restoreSlot(plan.date, stripNotificationHandles(slot));
    }
  }

  for (const routine of routines) {
    // `restoreRoutine`, not `addRoutine` — the latter mints a new id and
    // empties `exceptions`, which orphans every stop the routine made and
    // refills the days the user had deleted.
    routineStore.restoreRoutine(routine);
  }

  if (data.settings) {
    const settingsStore = useSettingsStore.getState();
    settingsStore.setThemePreference(data.settings.themePreference);
    settingsStore.setRainAlertsEnabled(data.settings.rainAlertsEnabled);
    settingsStore.setRainLeadMinutes(data.settings.rainLeadMinutes);
    settingsStore.setQuietHours(data.settings.quietHours);
    settingsStore.setDigest(data.settings.digest);
  }

  return { plans: plans.length, routines: routines.length };
}
