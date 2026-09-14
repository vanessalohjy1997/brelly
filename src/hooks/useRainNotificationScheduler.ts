import { useCallback } from "react";

import {
  findSlotById,
  getForecastForSlotByProvider,
  resolveSlotProvider,
  useItineraryStore,
  useSettingsStore,
  type ItinerarySlot,
} from "@brelly/core";
import {
  cancelNotification,
  scheduleRainNotification,
} from "@/services/notifications";

/**
 * Returns a function that fetches the current forecast for a slot and, if
 * it predicts rain, schedules a "bring an umbrella" notification and
 * persists the resulting notification id on the slot (so it can be
 * cancelled later). Fire-and-forget — call it after `addSlot`/`updateSlot`
 * without awaiting, so slot creation/edit never blocks on a forecast fetch.
 */
export function useRainNotificationScheduler() {
  const updateSlot = useItineraryStore((state) => state.updateSlot);
  const rainAlertsEnabled = useSettingsStore((state) => state.rainAlertsEnabled);
  const quietHours = useSettingsStore((state) => state.quietHours);
  const rainLeadMinutes = useSettingsStore((state) => state.rainLeadMinutes);

  return useCallback(
    async (date: string, slot: ItinerarySlot) => {
      if (!rainAlertsEnabled) return;

      const forecast = await getForecastForSlotByProvider({
        provider: resolveSlotProvider(slot.provider),
        region: slot.neaRegion,
        latitude: slot.latitude,
        longitude: slot.longitude,
        slotStartTime: slot.startTime,
      });
      const notificationId = await scheduleRainNotification(slot, forecast, {
        quietHours,
        leadMinutes: rainLeadMinutes,
      });
      if (!notificationId) return;

      // The forecast fetch above took time, and the slot may have moved on
      // while it was in flight: muted from a swipe, deleted, or re-keyed by a
      // "this day only" detach. `scheduleRainNotification` read the muted flag
      // off the copy it was handed, so by now it can be out of date.
      //
      // The handle has to be cancelled rather than merely dropped. Everything
      // that cleans up after an alert finds it through `slot.notificationId`
      // (`planNotificationResync`), so an id that never lands on a slot is an
      // alert nothing can ever cancel — it fires for a stop the user muted, or
      // for one that no longer exists.
      const current = findSlotById(
        useItineraryStore.getState().plans,
        slot.id,
      )?.slot;
      if (!current || current.notificationsMuted) {
        cancelNotification(notificationId).catch(() => {
          // Best-effort, like every other cancel in the app.
        });
        return;
      }

      updateSlot(date, slot.id, {
        notificationId,
        // Stamped so a later lead-time change can tell which alerts are
        // stale — the resync otherwise sees "has an alert, still rainy" and
        // leaves an alert scheduled against the old lead time forever.
        notificationLeadMinutes: rainLeadMinutes,
      });
    },
    [updateSlot, rainAlertsEnabled, quietHours, rainLeadMinutes],
  );
}
