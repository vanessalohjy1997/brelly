import { mmkvStorage } from "@/store/mmkvStorage";
import type { ThemePreference } from "@/utils/resolveColorScheme";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SettingsState = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themePreference: "system",
      setThemePreference: (preference) => set({ themePreference: preference }),
    }),
    {
      name: "brelly-settings",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
