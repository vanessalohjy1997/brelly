import type { DayPlan, ItinerarySlot } from "../types/itinerary";

type Handles = Pick<ItinerarySlot, "notificationId" | "notificationLeadMinutes">;

/**
 * Re-attaches this device's notification handles to a freshly hydrated set
 * of plans.
 *
 * `notificationId`/`notificationLeadMinutes` never reach Firestore (see
 * `stripNotificationHandles`), so a slots snapshot arrives without them —
 * and every snapshot replaces the whole `plans` array. Written straight into
 * the store, each one silently forgot every alert this device had scheduled:
 * the next sync read "no alert" on every rainy stop and queued another. The
 * write that stored a fresh handle was itself enough to trigger the snapshot
 * that wiped it, so each pass stacked one more alert per stop, forever.
 *
 * The handles are matched by slot id. A slot the snapshot no longer carries
 * drops its handle with it, which is right: the alert is an orphan, and the
 * sync's queue sweep (`reconcileScheduledAlerts`) is what cancels it.
 */
export function carryNotificationHandles(
  incoming: DayPlan[],
  current: DayPlan[],
): DayPlan[] {
  const handles = new Map<string, Handles>();
  for (const plan of current) {
    for (const slot of plan.slots) {
      if (!slot.notificationId) continue;
      const kept: Handles = { notificationId: slot.notificationId };
      // Only carry the key when it has a value: a literal `undefined` on a
      // slot is fine locally but crashes a full-doc Firestore write, and a
      // detach/restore later writes the whole slot.
      if (slot.notificationLeadMinutes !== undefined) {
        kept.notificationLeadMinutes = slot.notificationLeadMinutes;
      }
      handles.set(slot.id, kept);
    }
  }
  if (handles.size === 0) return incoming;

  return incoming.map((plan) => ({
    ...plan,
    slots: plan.slots.map((slot) => {
      const kept = handles.get(slot.id);
      return kept ? { ...slot, ...kept } : slot;
    }),
  }));
}
