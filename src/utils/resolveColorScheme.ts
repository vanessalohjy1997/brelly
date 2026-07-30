export type ThemePreference = "system" | "light" | "dark";

/**
 * Combines the user's theme preference with the device's system scheme.
 * "system" defers to whatever the OS reports; an explicit "light"/"dark"
 * preference overrides it. Falls back to "light" if the system scheme is
 * unavailable ("unspecified"/null), matching every other system-scheme
 * fallback already in this codebase (see `useTheme`, `WeatherBadge`, etc).
 */
export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | "unspecified" | null | undefined,
): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}
