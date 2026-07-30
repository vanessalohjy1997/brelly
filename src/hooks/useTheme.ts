/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { resolveColorScheme } from "@/utils/resolveColorScheme";
import { useColorScheme } from "react-native";

/**
 * The app's effective color scheme: the user's `themePreference` (Settings)
 * when explicit, otherwise the device's system scheme. Use this instead of
 * React Native's `useColorScheme` directly anywhere the result feeds into
 * theming, so a manual light/dark override applies consistently everywhere.
 */
export function useAppColorScheme(): "light" | "dark" {
  const systemScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);

  return resolveColorScheme(themePreference, systemScheme);
}

export function useTheme() {
  const scheme = useAppColorScheme();
  return Colors[scheme];
}
