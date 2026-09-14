import type { ItinerarySlot } from "@/types/itinerary";
import { planNotificationResync } from "@/utils/planNotificationResync";
import { stripNotificationHandles } from "@/utils/stripNotificationHandles";

const scheduled: ItinerarySlot = {
  id: "slot-1",
  label: "Botanic Gardens",
  location: "Cluny Rd, Singapore",
  neaRegion: "central",
  latitude: 1.3138,
  longitude: 103.8159,
  startTime: "2026-08-08T15:00:00.000Z",
  endTime: "2026-08-08T17:00:00.000Z",
  notificationId: "device-a-alert",
  notificationLeadMinutes: 45,
};

describe("stripNotificationHandles", () => {
  it("drops the id and the lead time it was scheduled against", () => {
    const stripped = stripNotificationHandles(scheduled);

    expect(stripped.notificationId).toBeUndefined();
    expect(stripped.notificationLeadMinutes).toBeUndefined();
  });

  it("keeps everything that isn't device-local", () => {
    const stripped = stripNotificationHandles({
      ...scheduled,
      notes: "bring water",
      routineId: "routine-1",
      notificationsMuted: true,
    });

    expect(stripped).toMatchObject({
      id: "slot-1",
      label: "Botanic Gardens",
      location: "Cluny Rd, Singapore",
      neaRegion: "central",
      startTime: "2026-08-08T15:00:00.000Z",
      endTime: "2026-08-08T17:00:00.000Z",
      notes: "bring water",
      routineId: "routine-1",
      // A per-slot opt-out is the user's own instruction, not a handle into
      // this device — it has to survive the trip.
      notificationsMuted: true,
    });
  });

  it("leaves the original alone", () => {
    stripNotificationHandles(scheduled);

    expect(scheduled.notificationId).toBe("device-a-alert");
  });

  it("is what makes the resync schedule an alert on the receiving device", () => {
    // The whole point, stated as the failure it prevents: an unstripped slot
    // reads as "already has an alert at the lead time you asked for", so the
    // resync does nothing and no alert is ever scheduled.
    const options = { rainAlertsEnabled: true, rainLeadMinutes: 45 };
    const entry = { date: "2026-08-08", forecastText: "Thundery Showers" };

    const carried = planNotificationResync(
      [{ ...entry, slot: scheduled }],
      options,
    );
    const stripped = planNotificationResync(
      [{ ...entry, slot: stripNotificationHandles(scheduled) }],
      options,
    );

    expect(carried).toEqual([]);
    expect(stripped).toEqual([
      { type: "schedule", date: "2026-08-08", slot: expect.anything() },
    ]);
  });
});
