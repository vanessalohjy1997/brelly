import type { DayPlan, ItinerarySlot } from "../types/itinerary";
import {
  reconcileScheduledAlerts,
  type ScheduledAlert,
} from "./reconcileScheduledAlerts";

// Fixed "now": 08:00 on 31 Jul 2026, local time.
const NOW = new Date(2026, 6, 31, 8, 0);

function slot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "s1",
    label: "Picnic",
    location: "East Coast Park",
    neaRegion: "east",
    latitude: 1.3009,
    longitude: 103.9124,
    startTime: new Date(2026, 6, 31, 16, 0).toISOString(),
    endTime: new Date(2026, 6, 31, 18, 0).toISOString(),
    ...overrides,
  };
}

const plans = (...slots: ItinerarySlot[]): DayPlan[] => [
  { id: "2026-07-31", date: "2026-07-31", slots },
];

const rain = (id: string, slotId = "s1", leadMinutes?: number): ScheduledAlert =>
  leadMinutes === undefined
    ? { id, kind: "rain", slotId }
    : { id, kind: "rain", slotId, leadMinutes };

describe("reconcileScheduledAlerts", () => {
  it("reads a queued alert onto a slot the store thought had none", () => {
    const { upcoming, cancel } = reconcileScheduledAlerts(plans(slot()), NOW, [
      rain("n1", "s1", 45),
    ]);

    expect(upcoming[0].slot).toMatchObject({
      notificationId: "n1",
      notificationLeadMinutes: 45,
    });
    expect(cancel).toEqual([]);
  });

  it("clears a store handle the queue does not hold", () => {
    const { upcoming } = reconcileScheduledAlerts(
      plans(slot({ notificationId: "gone", notificationLeadMinutes: 45 })),
      NOW,
      [],
    );

    expect("notificationId" in upcoming[0].slot).toBe(false);
    expect("notificationLeadMinutes" in upcoming[0].slot).toBe(false);
  });

  it("keeps the alert the store points at and cancels the other copies", () => {
    const { upcoming, cancel } = reconcileScheduledAlerts(
      plans(slot({ notificationId: "mine" })),
      NOW,
      [rain("dup-1"), rain("mine"), rain("dup-2")],
    );

    expect(upcoming[0].slot.notificationId).toBe("mine");
    expect(cancel.sort()).toEqual(["dup-1", "dup-2"]);
  });

  it("keeps the first copy when the store points at none of them", () => {
    const { upcoming, cancel } = reconcileScheduledAlerts(plans(slot()), NOW, [
      rain("first"),
      rain("second"),
    ]);

    expect(upcoming[0].slot.notificationId).toBe("first");
    expect(cancel).toEqual(["second"]);
  });

  it("leaves the lead time off when the queued alert carries none", () => {
    const { upcoming } = reconcileScheduledAlerts(plans(slot()), NOW, [
      rain("n1"),
    ]);

    expect(upcoming[0].slot.notificationId).toBe("n1");
    expect("notificationLeadMinutes" in upcoming[0].slot).toBe(false);
  });

  it("cancels alerts for a stop that no longer exists", () => {
    const { cancel } = reconcileScheduledAlerts(plans(slot()), NOW, [
      rain("stray-1", "deleted"),
      rain("stray-2", "deleted"),
    ]);

    expect(cancel.sort()).toEqual(["stray-1", "stray-2"]);
  });

  it("does not treat a past stop's alert as a stray", () => {
    const past = slot({
      id: "past",
      startTime: new Date(2026, 6, 31, 7, 0).toISOString(),
    });

    const { upcoming, cancel } = reconcileScheduledAlerts(plans(past), NOW, [
      rain("n-past", "past"),
    ]);

    expect(upcoming).toEqual([]);
    expect(cancel).toEqual([]);
  });

  it("cancels every untagged alert", () => {
    const { cancel } = reconcileScheduledAlerts(plans(slot()), NOW, [
      { id: "old-1", kind: "untagged" },
      { id: "old-2", kind: "untagged" },
    ]);

    expect(cancel.sort()).toEqual(["old-1", "old-2"]);
  });

  it("lists digests separately and never cancels them itself", () => {
    const { cancel, digests } = reconcileScheduledAlerts(plans(slot()), NOW, [
      { id: "d1", kind: "digest" },
      { id: "d2", kind: "digest" },
    ]);

    expect(digests).toEqual(["d1", "d2"]);
    expect(cancel).toEqual([]);
  });

  it("keeps the upcoming stops soonest first, with their dates", () => {
    const later = slot({
      id: "later",
      startTime: new Date(2026, 6, 31, 19, 0).toISOString(),
    });

    const { upcoming } = reconcileScheduledAlerts(plans(later, slot()), NOW, []);

    expect(upcoming.map(({ date, slot: s }) => `${date}/${s.id}`)).toEqual([
      "2026-07-31/s1",
      "2026-07-31/later",
    ]);
  });
});
