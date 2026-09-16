"use client";

import { useEffect } from "react";

import { useDeviceLocationStore } from "@/store/deviceLocationStore";
import { useTabVisible } from "./useTabVisible";

/**
 * Whether Brelly may read the browser's location, kept honest without
 * prompting.
 *
 * Two effects, both because the browser owns this answer and changes it behind
 * the page's back:
 *
 * - read the existing status on mount, so someone who granted it on a previous
 *   visit or in another tab is not asked again;
 * - re-read whenever the tab comes back to the foreground. The site-settings
 *   panel is where this answer is changed and the page is not told, so
 *   returning is the only chance to notice — in both directions. A grant
 *   switched *off* there would otherwise leave every screen still saying
 *   "Location is on", holding the point it last had.
 */
export function useDeviceLocationPermission(enabled = true) {
  const permission = useDeviceLocationStore((state) => state.permission);
  const sync = useDeviceLocationStore((state) => state.sync);
  const request = useDeviceLocationStore((state) => state.request);

  useEffect(() => {
    if (!enabled) return;
    void sync();
  }, [enabled, sync]);

  useTabVisible(() => void sync(), enabled);

  return { permission, request };
}
