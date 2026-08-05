import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { useSettingsStore } from "@/store/settingsStore";

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
    itinerary: { plans: itinerary.plans },
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

  const itineraryStore = useItineraryStore.getState();
  const routineStore = useRoutineStore.getState();

  for (const plan of plans) {
    for (const slot of plan.slots) {
      itineraryStore.restoreSlot(plan.date, slot);
    }
  }

  for (const routine of routines) {
    routineStore.addRoutine(routine);
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
