import { useCallback } from "react";

import { getForecastForSlotByProvider } from "@/services/forecastProvider";
import { scheduleRainNotification } from "@/services/notifications";
import { useItineraryStore } from "@/store/itineraryStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ItinerarySlot } from "@/types/itinerary";
import { resolveSlotProvider } from "@/utils/weatherProvider";

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
