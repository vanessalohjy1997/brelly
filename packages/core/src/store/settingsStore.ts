import { create } from "zustand";

import { writeSettingsFields } from "@/services/settingsSync";
import type { ThemePreference } from "@/utils/resolveColorScheme";

export type QuietHours = {
  enabled: boolean;
  start: string; // "HH:MM", 24-hour
  end: string; // "HH:MM", may be earlier than `start` — the window wraps midnight
};

/**
 * How much warning a rain alert gives, in minutes. Constrained to a few whole
 * choices — how much warning someone needs is the walk to the MRT versus a
 * drive across the island, not a number worth typing.
 */
export const RAIN_LEAD_MINUTES = [15, 30, 45, 60] as const;
export type RainLeadMinutes = (typeof RAIN_LEAD_MINUTES)[number];

export type DigestSettings = {
  enabled: boolean;
  time: string; // "HH:MM", 24-hour
};

type SettingsState = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;

  rainAlertsEnabled: boolean;
  setRainAlertsEnabled: (enabled: boolean) => void;

  rainLeadMinutes: RainLeadMinutes;
  setRainLeadMinutes: (minutes: RainLeadMinutes) => void;

  quietHours: QuietHours;
  setQuietHours: (quietHours: Partial<QuietHours>) => void;

  digest: DigestSettings;
  setDigest: (digest: Partial<DigestSettings>) => void;

  /** Id of the currently scheduled digest, so it can be replaced or cancelled. */
  digestNotificationId: string | null;
  setDigestNotificationId: (id: string | null) => void;

  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (seen: boolean) => void;
};

/**
 * The fields that live in the cloud settings doc — every `SettingsState`
 * field except `digestNotificationId`, which is a handle into this device's
 * scheduled notification and must never leave it (see
 * FIREBASE_MIGRATION.md). Doubles as the merge target for a settings
 * snapshot, replicating the `{...defaults, ...persisted}` merge the old
 * zustand `persist` did implicitly on rehydrate.
 */
export const DEFAULT_SETTINGS = {
  themePreference: "system" as ThemePreference,
  rainAlertsEnabled: true,
  // 45 was the hardcoded constant before this became a setting, so existing
  // installs keep the behaviour they already had.
  rainLeadMinutes: 45 as RainLeadMinutes,
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  digest: { enabled: false, time: "07:30" },
  hasSeenOnboarding: false,
};

// Firestore is now the source of truth (`useCloudBootstrap` hydrates this
// store from the settings doc's `onSnapshot`), so there is no `persist`
// middleware here any more. Every setter keeps its old synchronous shape —
// `set()` first for an instant local update, then a fire-and-forget cloud
// write underneath it. See FIREBASE_MIGRATION.md's "keep every store
// action's public shape" section.
export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,

  setThemePreference: (preference) => {
    set({ themePreference: preference });
    writeSettingsFields({ themePreference: preference });
  },

  setRainAlertsEnabled: (enabled) => {
    set({ rainAlertsEnabled: enabled });
    writeSettingsFields({ rainAlertsEnabled: enabled });
  },

  setRainLeadMinutes: (minutes) => {
    set({ rainLeadMinutes: minutes });
    writeSettingsFields({ rainLeadMinutes: minutes });
  },

  setQuietHours: (quietHours) =>
    set((state) => {
      const next = { ...state.quietHours, ...quietHours };
      writeSettingsFields({ quietHours: next });
      return { quietHours: next };
    }),

  setDigest: (digest) =>
    set((state) => {
      const next = { ...state.digest, ...digest };
      writeSettingsFields({ digest: next });
      return { digest: next };
    }),

  digestNotificationId: null,
  // Device-local — deliberately never written to Firestore, see
  // `DEFAULT_SETTINGS`'s comment above.
  setDigestNotificationId: (id) => set({ digestNotificationId: id }),

  setHasSeenOnboarding: (seen) => {
    set({ hasSeenOnboarding: seen });
    writeSettingsFields({ hasSeenOnboarding: seen });
  },
}));
