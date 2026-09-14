import {
  migrateSettingsDoc,
  SETTINGS_SCHEMA_VERSION,
  toCloudSettingsFields,
} from "@/utils/migrateSettingsDoc";

describe("migrateSettingsDoc", () => {
  it("sets hasSeenOnboarding for anything predating version 2", () => {
    const migrated = migrateSettingsDoc({ themePreference: "dark" }, 1);

    expect(migrated.hasSeenOnboarding).toBe(true);
    expect(migrated.themePreference).toBe("dark");
  });

  it("leaves an already-current doc untouched", () => {
    const migrated = migrateSettingsDoc(
      { themePreference: "dark", hasSeenOnboarding: false },
      SETTINGS_SCHEMA_VERSION,
    );

    expect(migrated.hasSeenOnboarding).toBe(false);
  });

  it("treats a missing doc as an empty object rather than throwing", () => {
    expect(migrateSettingsDoc(undefined, 1)).toEqual({
      hasSeenOnboarding: true,
    });
  });

  it("strips the transport-only schemaVersion field from its output", () => {
    const migrated = migrateSettingsDoc(
      { schemaVersion: 2, themePreference: "light" },
      2,
    );

    expect(migrated).not.toHaveProperty("schemaVersion");
    expect(migrated.themePreference).toBe("light");
  });
});

describe("toCloudSettingsFields", () => {
  it("whitelists only the fields that belong in the cloud doc", () => {
    const fields = toCloudSettingsFields({
      themePreference: "dark",
      rainAlertsEnabled: true,
      rainLeadMinutes: 45,
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
      digest: { enabled: false, time: "07:30" },
      hasSeenOnboarding: true,
      digestNotificationId: "notif-123",
    });

    expect(fields).toEqual({
      themePreference: "dark",
      rainAlertsEnabled: true,
      rainLeadMinutes: 45,
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
      digest: { enabled: false, time: "07:30" },
      hasSeenOnboarding: true,
    });
    expect(fields).not.toHaveProperty("digestNotificationId");
  });
});
