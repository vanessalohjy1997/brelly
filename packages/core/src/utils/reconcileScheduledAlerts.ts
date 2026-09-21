import type { DayPlan } from "../types/itinerary";
import { allSlotsWithDates, upcomingSlots, type FoundSlot } from "./planSelectors";

/**
 * One entry of the OS notification queue, as the app tagged it when it was
 * scheduled (`content.data.kind`). `untagged` is an alert from a build that
 * predates the tagging: nothing can tell which stop it belongs to, so the
 * sync cancels it and lets the next pass schedule a tagged replacement.
 */
export type ScheduledAlert =
  | { id: string; kind: "rain"; slotId: string; leadMinutes?: number }
  | { id: string; kind: "digest" }
  | { id: string; kind: "untagged" };

export type AlertReconciliation = {
  /**
   * The upcoming slots, each with `notificationId`/`notificationLeadMinutes`
   * set to the alert the OS actually holds for it — or cleared when it holds
   * none, whatever the store believed.
   */
  upcoming: FoundSlot[];
  /**
   * Alerts to cancel: a second (or third…) alert for the same stop, an alert
   * for a stop that no longer exists, and every untagged one.
   */
  cancel: string[];
  /** Every queued digest; the digest is one-shot and re-created each sync. */
  digests: string[];
};

/**
 * Makes the OS queue, not the in-memory store, the record of which alerts
 * exist.
 *
 * The store's handles are the weaker source: they live only in memory, so
 * every cold start forgets them, and they used to be wiped by every cloud
 * snapshot too (see `carryNotificationHandles`). Each time that happened the
 * sync scheduled another alert for a stop that already had one. Reading the
 * queue back — every alert is tagged with its slot id when scheduled — lets
 * the sync see the duplicates it caused and cancel all but one, and stops it
 * causing more: a stop whose alert is queued reads as scheduled no matter
 * what the store forgot.
 *
 * When a stop has several alerts, the one the store still points at is the
 * one kept, so an id a screen is holding stays valid.
 */
export function reconcileScheduledAlerts(
  plans: DayPlan[],
  now: Date,
  queue: ScheduledAlert[],
): AlertReconciliation {
  const bySlot = new Map<string, Extract<ScheduledAlert, { kind: "rain" }>[]>();
  const cancel: string[] = [];
  const digests: string[] = [];

  for (const alert of queue) {
    if (alert.kind === "digest") {
      digests.push(alert.id);
    } else if (alert.kind === "untagged") {
      cancel.push(alert.id);
    } else {
      bySlot.set(alert.slotId, [...(bySlot.get(alert.slotId) ?? []), alert]);
    }
  }

  // An alert for a stop that is gone. Checked against every stop, not just
  // the upcoming ones: a stop edited into the past keeps its (now useless)
  // alert until the OS drops it, and that is not the sync's to second-guess.
  const knownSlotIds = new Set(allSlotsWithDates(plans).map(({ slot }) => slot.id));
  for (const [slotId, alerts] of bySlot) {
    if (!knownSlotIds.has(slotId)) {
      cancel.push(...alerts.map((alert) => alert.id));
      bySlot.delete(slotId);
    }
  }

  const upcoming = upcomingSlots(plans, now).map(({ date, slot }) => {
    const alerts = bySlot.get(slot.id) ?? [];
    const kept =
      alerts.find((alert) => alert.id === slot.notificationId) ?? alerts[0];
    cancel.push(
      ...alerts.filter((alert) => alert !== kept).map((alert) => alert.id),
    );

    const { notificationId, notificationLeadMinutes, ...rest } = slot;
    const corrected = kept
      ? {
          ...rest,
          notificationId: kept.id,
          ...(kept.leadMinutes !== undefined
            ? { notificationLeadMinutes: kept.leadMinutes }
            : {}),
        }
      : rest;
    return { date, slot: corrected };
  });

  return { upcoming, cancel, digests };
}
