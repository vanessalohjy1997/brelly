import { mmkvStorage } from "@/store/mmkvStorage";
import type { ThemePreference } from "@/utils/resolveColorScheme";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type QuietHours = {
  enabled: boolean;
  start: string; // "HH:MM", 24-hour
  end: string; // "HH:MM", may be earlier than `start` — the window wraps midnight
};

export type DigestSettings = {
  enabled: boolean;
  time: string; // "HH:MM", 24-hour
};

type SettingsState = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;

  rainAlertsEnabled: boolean;
  setRainAlertsEnabled: (enabled: boolean) => void;

  quietHours: QuietHours;
  setQuietHours: (quietHours: Partial<QuietHours>) => void;

  digest: DigestSettings;
  setDigest: (digest: Partial<DigestSettings>) => void;

  /** Id of the currently scheduled digest, so it can be replaced or cancelled. */
  digestNotificationId: string | null;
  setDigestNotificationId: (id: string | null) => void;
};

// New keys added here land on installs whose persisted state predates them.
// Zustand's `persist` shallow-merges stored state over these defaults, so a
// missing key falls back rather than arriving as undefined — which is why
// none of this needs a migration.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themePreference: "system",
      setThemePreference: (preference) => set({ themePreference: preference }),

      rainAlertsEnabled: true,
      setRainAlertsEnabled: (enabled) => set({ rainAlertsEnabled: enabled }),

      quietHours: { enabled: false, start: "22:00", end: "07:00" },
      setQuietHours: (quietHours) =>
        set((state) => ({ quietHours: { ...state.quietHours, ...quietHours } })),

      digest: { enabled: false, time: "07:30" },
      setDigest: (digest) =>
        set((state) => ({ digest: { ...state.digest, ...digest } })),

      digestNotificationId: null,
      setDigestNotificationId: (id) => set({ digestNotificationId: id }),
    }),
    {
      name: "brelly-settings",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
