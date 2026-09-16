import {
  stripNotificationHandles,
  useItineraryStore,
  useRoutineStore,
  useSettingsStore,
} from "@brelly/core";

/**
 * Exactly the shape `apps/mobile/src/services/backup.ts` writes, and that is a
 * requirement rather than a coincidence: a file exported from a laptop has to
 * import on a phone, so the two writers agree on `version: 1` or neither is
 * worth having.
 *
 * The settings block still carries the notification fields the web never shows.
 * They are read from the store, which holds whatever the phone last wrote, so a
 * backup taken here keeps a phone's alert settings rather than silently
 * exporting the defaults over them.
 */
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

/** Everything the file holds, as a value — split out so it can be asserted on. */
export function buildBackup(): BackupData {
  const itinerary = useItineraryStore.getState();
  const routines = useRoutineStore.getState();
  const settings = useSettingsStore.getState();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    itinerary: {
      // A backup outlives the device that wrote it — that is the entire point
      // of one — so the per-device notification bookkeeping must not travel
      // with it. See `stripNotificationHandles`.
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
}

/** `brelly-backup-2026-09-15.json` — the day is what makes two of them sortable. */
export function backupFilename(now = new Date()): string {
  const [date] = now.toISOString().split("T");
  return `brelly-backup-${date}.json`;
}

/**
 * Saves the backup as a file.
 *
 * The phone hands the file to `expo-sharing`, which opens the share sheet. The
 * browser has no such handoff: a download *is* the share sheet, and the only
 * way to start one from script is a same-origin anchor with `download` on it.
 * The object URL is revoked immediately afterwards — the click has already
 * handed the blob to the download, and leaving the URL alive pins the whole
 * file in memory for the life of the document.
 */
export function exportBackup(): void {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backupFilename();
  anchor.click();
  URL.revokeObjectURL(url);
}
