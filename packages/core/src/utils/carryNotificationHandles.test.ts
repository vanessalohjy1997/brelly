import type { DayPlan, ItinerarySlot } from "../types/itinerary";
import { carryNotificationHandles } from "./carryNotificationHandles";

function slot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "s1",
    label: "Picnic",
    location: "East Coast Park",
    neaRegion: "east",
    latitude: 1.3009,
    longitude: 103.9124,
    startTime: "2026-07-31T16:00:00+08:00",
    endTime: "2026-07-31T18:00:00+08:00",
    ...overrides,
  };
}

const plans = (...slots: ItinerarySlot[]): DayPlan[] => [
  { id: "2026-07-31", date: "2026-07-31", slots },
];

describe("carryNotificationHandles", () => {
  it("re-attaches the handle a snapshot arrived without, by slot id", () => {
    const current = plans(
      slot({ notificationId: "notif-1", notificationLeadMinutes: 30 }),
    );
    const incoming = plans(slot({ label: "Picnic at the beach" }));

    const [plan] = carryNotificationHandles(incoming, current);

    expect(plan.slots[0]).toMatchObject({
      label: "Picnic at the beach",
      notificationId: "notif-1",
      notificationLeadMinutes: 30,
    });
  });

  it("leaves the lead-time key off when the current slot has none", () => {
    // A key present with a literal `undefined` crashes a full-doc Firestore
    // write, and a later detach writes the whole slot.
    const current = plans(slot({ notificationId: "notif-1" }));

    const [plan] = carryNotificationHandles(plans(slot()), current);

    expect(plan.slots[0].notificationId).toBe("notif-1");
    expect("notificationLeadMinutes" in plan.slots[0]).toBe(false);
  });

  it("drops the handle of a slot the snapshot no longer carries", () => {
    const current = plans(slot({ id: "gone", notificationId: "notif-1" }));

    const result = carryNotificationHandles(plans(slot({ id: "kept" })), current);

    expect(result[0].slots[0].notificationId).toBeUndefined();
  });

  it("does not invent a handle for a slot that never had one", () => {
    const current = plans(slot({ id: "other", notificationId: "notif-1" }));

    const [plan] = carryNotificationHandles(plans(slot()), current);

    expect(plan.slots[0].notificationId).toBeUndefined();
  });

  it("returns the incoming array untouched when nothing is scheduled", () => {
    const incoming = plans(slot());

    expect(carryNotificationHandles(incoming, plans(slot()))).toBe(incoming);
  });

  it("follows a slot that moved to another day", () => {
    const current = plans(slot({ notificationId: "notif-1" }));
    const incoming: DayPlan[] = [
      {
        id: "2026-08-01",
        date: "2026-08-01",
        slots: [slot({ startTime: "2026-08-01T16:00:00+08:00" })],
      },
    ];

    const [plan] = carryNotificationHandles(incoming, current);

    expect(plan.slots[0].notificationId).toBe("notif-1");
  });
});
