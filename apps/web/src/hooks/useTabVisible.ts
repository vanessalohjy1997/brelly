"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `onVisible` when the tab comes back to the foreground.
 *
 * The browser's answer to the five `AppState` subscriptions the phone has. The
 * two events are not quite the same thing and the difference matters in one
 * direction only: `visibilitychange` fires for a tab switch as well as for a
 * window that was minimised, so this runs *more* often than `AppState`'s
 * `"active"` does, never less. Everything behind it is either idempotent (a
 * permission read, a routine top-up) or already cached (a forecast query).
 *
 * The callback is read through a ref with a stable dependency list, so an
 * ordinary re-render does not tear the listener down and re-run the work —
 * the same shape `useNotificationSync` uses on the phone, and for the same
 * reason.
 */
export function useTabVisible(onVisible: () => void, enabled = true): void {
  const latest = useRef(onVisible);

  useEffect(() => {
    latest.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    if (!enabled) return;

    const handler = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [enabled]);
}
