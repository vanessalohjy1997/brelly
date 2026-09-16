"use client";

import { useSyncExternalStore } from "react";

import { resolveColorScheme, useSettingsStore } from "@brelly/core";
import { Colors } from "@/constants/theme";

/**
 * The system's own light/dark preference, as a subscription.
 *
 * `useSyncExternalStore` rather than `useState` + an effect, because the server
 * has to answer too: its snapshot is `"light"`, which matches the bare `:root`
 * block in the emitted tokens, so the markup the server produces and the markup
 * the client first produces agree. Reading `matchMedia` during render instead
 * would hydrate-mismatch on every dark-mode machine.
 */
export function useSystemColorScheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeToColorScheme, getSystemScheme, () => "light");
}

function query(): MediaQueryList | null {
  return typeof window === "undefined" ? null : window.matchMedia("(prefers-color-scheme: dark)");
}

function subscribeToColorScheme(onChange: () => void): () => void {
  const media = query();
  if (!media) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSystemScheme(): "light" | "dark" {
  return query()?.matches ? "dark" : "light";
}

/**
 * The app's effective colour scheme: the user's `themePreference` when explicit,
 * otherwise the system's. The same `resolveColorScheme` the phone uses, handed
 * the browser's answer instead of React Native's.
 */
export function useAppColorScheme(): "light" | "dark" {
  const systemScheme = useSystemColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);

  return resolveColorScheme(themePreference, systemScheme);
}

/**
 * The palette as JavaScript values.
 *
 * Needed far less often here than on the phone: a colour in this app is
 * normally a CSS custom property, which follows the theme without anything
 * re-rendering. Reach for this only where a colour has to *be* a value — an
 * inline SVG attribute, a canvas, a `<meta name="theme-color">`.
 */
export function useTheme() {
  return Colors[useAppColorScheme()];
}
