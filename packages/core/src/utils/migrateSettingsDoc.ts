export const SETTINGS_SCHEMA_VERSION = 2;

/**
 * Ported from settingsStore's old zustand `persist` `migrate` — sets
 * `hasSeenOnboarding: true` for anything predating version 2, so a returning
 * user doesn't see the onboarding primer again. Kept as a plain function so
 * it is testable without Firestore or a store, and reused on both the
 * settings doc's `onSnapshot` handler and the one-time local→cloud
 * migration's read of the raw MMKV blob — see FIREBASE_MIGRATION.md.
 */
export function migrateSettingsDoc(
  raw: Record<string, unknown> | undefined,
  schemaVersion: number,
): Record<string, unknown> {
  const state = { ...(raw ?? {}) };
  delete state.schemaVersion;
  if (schemaVersion < 2) {
    state.hasSeenOnboarding = true;
  }
  return state;
}

/**
 * Whitelists the fields that belong in the cloud settings doc.
 * `digestNotificationId` is a handle into this device's scheduled digest
 * notification — carrying it to Firestore and reading it back on another
 * device would make that device believe a digest is already scheduled, the
 * same trap `stripNotificationHandles` exists for on slots. There is no
 * shared helper for it because settings has only the one field to exclude.
 */
export function toCloudSettingsFields(
  state: Record<string, unknown>,
): Record<string, unknown> {
  return {
    themePreference: state.themePreference,
    rainAlertsEnabled: state.rainAlertsEnabled,
    rainLeadMinutes: state.rainLeadMinutes,
    quietHours: state.quietHours,
    digest: state.digest,
    hasSeenOnboarding: state.hasSeenOnboarding,
  };
}
