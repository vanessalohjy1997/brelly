import type { ItinerarySlot } from "@/types/itinerary";
import { shouldNotifyForRain } from "@/utils/shouldNotifyForRain";

export type ResyncEntry = {
  date: string;
  slot: ItinerarySlot;
  /**
   * The forecast as of *now*, not as of when the slot was created — or null
   * if it couldn't be determined (the request failed, or NEA has no entry
   * for this slot yet).
   */
  forecastText: string | null;
};

export type ResyncAction =
  | { type: "schedule"; date: string; slot: ItinerarySlot }
  | { type: "cancel"; date: string; slot: ItinerarySlot; notificationId: string };

/**
 * Decides what to do with each upcoming slot's rain notification given a
 * freshly fetched forecast.
 *
 * This exists because a notification is scheduled once, when the slot is
 * created — potentially against a 4-day outlook — and then fires 45 minutes
 * before the slot regardless of what the weather did in between. Re-running
 * this on app foreground means the alert reflects the current forecast:
 * scheduling one for rain that appeared, and cancelling one for rain that
 * cleared.
 *
 * Slots that are already correct produce no action, so an app launch with
 * nothing to change issues no notification calls at all.
 */
/**
 * The lead time slots created before it became a setting were scheduled
 * against. Treating those as 45 rather than "unknown" is what stops the first
 * sync after this shipped from cancelling and rescheduling every alert.
 */
const LEGACY_LEAD_MINUTES = 45;

export function planNotificationResync(
  entries: ResyncEntry[],
  options: { rainAlertsEnabled: boolean; rainLeadMinutes: number },
): ResyncAction[] {
  const actions: ResyncAction[] = [];

  for (const { date, slot, forecastText } of entries) {
    const hasAlert = !!slot.notificationId;
    const cancel = (): void => {
      if (hasAlert) {
        actions.push({
          type: "cancel",
          date,
          slot,
          notificationId: slot.notificationId!,
        });
      }
    };

    // An opt-out is the user's own instruction and doesn't depend on knowing
    // the weather, so it applies even when the forecast fetch failed.
    if (!options.rainAlertsEnabled || slot.notificationsMuted) {
      cancel();
      continue;
    }

    // Past that, no usable forecast means no new information — leave the slot
    // exactly as it is. Reading a failed fetch as "no rain" would let a
    // network blip silently cancel an alert the user is relying on.
    if (forecastText === null) continue;

    if (shouldNotifyForRain(forecastText)) {
      if (!hasAlert) {
        actions.push({ type: "schedule", date, slot });
        continue;
      }

      // An alert scheduled against a different lead time is wrong even though
      // the forecast hasn't changed — cancel it and schedule a fresh one, or
      // the setting silently only applies to plans created after it changed.
      const scheduledLead = slot.notificationLeadMinutes ?? LEGACY_LEAD_MINUTES;
      if (scheduledLead !== options.rainLeadMinutes) {
        cancel();
        actions.push({ type: "schedule", date, slot });
      }
    } else {
      cancel();
    }
  }

  return actions;
}
