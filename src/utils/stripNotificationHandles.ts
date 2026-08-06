import type { ItinerarySlot } from "@/types/itinerary";

/**
 * Drops the bookkeeping that only means anything on the device that wrote it.
 *
 * `notificationId` is a handle into *this* device's notification queue and
 * `notificationLeadMinutes` is the lead time that particular alert was
 * scheduled against. Carried anywhere else — onto another device, or back onto
 * this one after the alert was already cancelled — they leave the slot looking
 * permanently scheduled: `planNotificationResync` reads `!!notificationId` as
 * "has an alert", finds the lead time unchanged, and takes no action. No alert
 * is ever scheduled and nothing on screen says so, which makes this the quiet
 * kind of wrong.
 *
 * It half-works, too, which is worse. If the receiving device's
 * `rainLeadMinutes` happens to differ from the imported one, the resync
 * cancels (a no-op against an id the OS doesn't have) and reschedules, so the
 * alert arrives. The failure only bites when the two agree — the default.
 *
 * This is a function rather than two lines repeated at each call site because
 * repeating them is exactly how it went wrong: `useDeleteSlotWithUndo` did the
 * strip and `backup.ts`'s import did not, so every restored stop silently lost
 * its rain alert. Anything that moves a slot across a device or account
 * boundary goes through here.
 */
export function stripNotificationHandles(slot: ItinerarySlot): ItinerarySlot {
  return {
    ...slot,
    notificationId: undefined,
    notificationLeadMinutes: undefined,
  };
}
