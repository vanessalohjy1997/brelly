import { useCallback } from "react";

import { scheduleRainNotification } from "@/services/notifications";
import { getForecastForSlot } from "@/services/weather";
import { useItineraryStore } from "@/store/itineraryStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ItinerarySlot } from "@/types/itinerary";

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

      const forecast = await getForecastForSlot(
        slot.neaRegion,
        slot.latitude,
        slot.longitude,
        slot.startTime,
      );
      const notificationId = await scheduleRainNotification(slot, forecast, {
        quietHours,
        leadMinutes: rainLeadMinutes,
      });
      if (notificationId) {
        updateSlot(date, slot.id, {
          notificationId,
          // Stamped so a later lead-time change can tell which alerts are
          // stale — the resync otherwise sees "has an alert, still rainy" and
          // leaves an alert scheduled against the old lead time forever.
          notificationLeadMinutes: rainLeadMinutes,
        });
      }
    },
    [updateSlot, rainAlertsEnabled, quietHours, rainLeadMinutes],
  );
}
