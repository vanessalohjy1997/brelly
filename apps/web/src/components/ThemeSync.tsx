"use client";

import { useEffect } from "react";

import { useSettingsStore } from "@brelly/core";
import { serialiseThemeCookie, themeAttribute } from "@/utils/themeCookie";

/**
 * Keeps `<html data-theme>` in step with the Firestore-backed preference, and
 * mirrors it to a cookie so the *next* visit can be server-rendered correctly.
 *
 * Renders nothing. It is a component rather than a hook called from the layout
 * because the layout is a server component and this has to be a client one —
 * which is also why it is cheap: one effect, no subtree.
 *
 * The attribute is removed rather than set to `"system"`. `:root[data-theme]`
 * has to *lose* to `prefers-color-scheme` when the preference is to follow the
 * system, and the only reliable way to lose a specificity contest is not to
 * enter it.
 */
export function ThemeSync() {
  const themePreference = useSettingsStore((state) => state.themePreference);

  useEffect(() => {
    const attribute = themeAttribute(themePreference);
    if (attribute) {
      document.documentElement.dataset.theme = attribute;
    } else {
      delete document.documentElement.dataset.theme;
    }

    document.cookie = serialiseThemeCookie(themePreference);
  }, [themePreference]);

  return null;
}
