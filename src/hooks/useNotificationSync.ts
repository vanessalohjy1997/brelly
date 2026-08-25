import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";

import {
  runNotificationSync,
  type NotificationSyncContext,
} from "@/services/notificationSync";
import { useItineraryStore } from "@/store/itineraryStore";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * How long to wait after the last structural plan change before re-syncing. A
 * burst of edits (or a cloud snapshot that arrives slot-by-slot) collapses into
 * one pass rather than one forecast fetch per intermediate state.
 */
const SYNC_DEBOUNCE_MS = 300;

/**
 * Keeps scheduled notifications and the home/lock-screen widget in step with
 * the current forecast and settings: on mount, whenever the set of stops
 * structurally changes, and every time the app returns to the foreground.
 *
 * The store hydrates from Firestore (`useCloudBootstrap`'s `onSnapshot`)
 * *after* this mounts, so a mount-only sync races that hydration and would
 * publish an empty glance from `plans: []`. Re-running when the plan signature
 * changes is what gets the first real forecast and widget snapshot out once the
 * data lands — and it covers a stop added or re-timed while the app is open.
 *
 * Mounted once, at the root. The AppState subscription is registered with an
 * empty dependency list and reads state through a ref, so editing a plan
 * doesn't tear down and re-register the listener.
 */
export function useNotificationSync(): void {
  const plans = useItineraryStore((state) => state.plans);
  const updateSlot = useItineraryStore((state) => state.updateSlot);
  const rainAlertsEnabled = useSettingsStore((state) => state.rainAlertsEnabled);
  const quietHours = useSettingsStore((state) => state.quietHours);
  const rainLeadMinutes = useSettingsStore((state) => state.rainLeadMinutes);
  const digest = useSettingsStore((state) => state.digest);
  const digestNotificationId = useSettingsStore(
    (state) => state.digestNotificationId,
  );
  const setDigestNotificationId = useSettingsStore(
    (state) => state.setDigestNotificationId,
  );

  const latest = useRef<NotificationSyncContext>({
    plans,
    now: new Date(),
    settings: { rainAlertsEnabled, rainLeadMinutes, quietHours, digest },
    digestNotificationId,
    updateSlot,
    setDigestNotificationId,
  });

  useEffect(() => {
    latest.current = {
      plans,
      now: new Date(),
      settings: { rainAlertsEnabled, rainLeadMinutes, quietHours, digest },
      digestNotificationId,
      updateSlot,
      setDigestNotificationId,
    };
  }, [
    plans,
    rainAlertsEnabled,
    rainLeadMinutes,
    quietHours,
    digest,
    digestNotificationId,
    updateSlot,
    setDigestNotificationId,
  ]);

  const sync = useCallback(() => {
    runNotificationSync({ ...latest.current, now: new Date() }).catch(() => {
      // Notification upkeep is background work — a failure here should never
      // surface as an error in front of the user.
    });
  }, []);

  // A structural fingerprint of the plans: it changes when a stop is added,
  // removed, or re-timed — the things that change what the next slot is and
  // where its forecast window falls — but not when an unrelated field (a label,
  // a note, a mute toggle) is edited. Keying the debounced sync on this is what
  // avoids a forecast fetch on every keystroke while still catching hydration.
  const planSignature = useMemo(
    () =>
      plans
        .flatMap((plan) =>
          plan.slots.map((slot) => `${slot.id}:${slot.startTime}`),
        )
        .join("|"),
    [plans],
  );

  // Foreground returns: re-sync immediately so a glance opened straight from
  // the lock screen reflects any weather change from while the app was away.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => subscription.remove();
  }, [sync]);

  // Mount and every structural plan change, debounced.
  useEffect(() => {
    const handle = setTimeout(sync, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [planSignature, sync]);
}
