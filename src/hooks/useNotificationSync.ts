import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import {
  runNotificationSync,
  type NotificationSyncContext,
} from "@/services/notificationSync";
import { useItineraryStore } from "@/store/itineraryStore";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Keeps scheduled notifications in step with the current forecast and
 * settings, on mount and every time the app returns to the foreground.
 *
 * Mounted once, at the root. The AppState subscription is registered with an
 * empty dependency list and reads state through a ref, so editing a plan
 * doesn't tear down and re-register the listener — which would fire a fresh
 * round of forecast requests on every keystroke-level store write.
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

  useEffect(() => {
    const sync = () => {
      runNotificationSync({ ...latest.current, now: new Date() }).catch(() => {
        // Notification upkeep is background work — a failure here should
        // never surface as an error in front of the user.
      });
    };

    sync();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => subscription.remove();
  }, []);
}
