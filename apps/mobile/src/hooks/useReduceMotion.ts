import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the user has asked the system to cut down on motion.
 *
 * Respecting it is not a nicety: for people with vestibular disorders, a
 * scaling, fading overlay across the whole screen is nauseating, and the
 * setting is the only way they have to say so. Nothing in the app read it.
 *
 * Defaults to `false` while the first read is in flight, so a device that
 * doesn't care gets the animation on the very first frame rather than a
 * flicker into it. The setting is re-read on change — it can be toggled from
 * Control Centre without the app restarting.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  const read = useCallback(
    () => AccessibilityInfo.isReduceMotionEnabled(),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    read()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => {
        // Platforms without the API (web) resolve nowhere useful; leaving the
        // default alone means they animate, which is what they did before.
      });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(enabled),
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [read]);

  return reduceMotion;
}
