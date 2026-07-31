import type { ItinerarySlot } from "@/types/itinerary";
import { planNotificationResync } from "@/utils/planNotificationResync";

function slot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "s1",
    label: "Lunch with Sam",
    location: "Tanjong Pagar, Singapore",
    neaRegion: "central",
    latitude: 1.2766,
    longitude: 103.8456,
    startTime: "2026-07-31T12:30:00+08:00",
    endTime: "2026-07-31T13:30:00+08:00",
    ...overrides,
  };
}

const ENABLED = { rainAlertsEnabled: true };

describe("planNotificationResync", () => {
  it("schedules when rain appeared in a forecast that had no alert", () => {
    const target = slot();
    const actions = planNotificationResync(
      [{ date: "2026-07-31", slot: target, forecastText: "Thundery Showers" }],
      ENABLED,
    );

    expect(actions).toEqual([
      { type: "schedule", date: "2026-07-31", slot: target },
    ]);
  });

  it("cancels when the rain cleared out of a slot that has an alert", () => {
    const target = slot({ notificationId: "notif-1" });
    const actions = planNotificationResync(
      [{ date: "2026-07-31", slot: target, forecastText: "Partly Cloudy" }],
      ENABLED,
    );

    expect(actions).toEqual([
      {
        type: "cancel",
        date: "2026-07-31",
        slot: target,
        notificationId: "notif-1",
      },
    ]);
  });

  it("does nothing when a rainy slot already has its alert", () => {
    const actions = planNotificationResync(
      [
        {
          date: "2026-07-31",
          slot: slot({ notificationId: "notif-1" }),
          forecastText: "Light Rain",
        },
      ],
      ENABLED,
    );

    expect(actions).toEqual([]);
  });

  it("does nothing when a dry slot has no alert", () => {
    const actions = planNotificationResync(
      [{ date: "2026-07-31", slot: slot(), forecastText: "Fair (Day)" }],
      ENABLED,
    );

    expect(actions).toEqual([]);
  });

  it("cancels an existing alert for a slot the user muted", () => {
    const target = slot({ notificationId: "notif-1", notificationsMuted: true });
    const actions = planNotificationResync(
      [{ date: "2026-07-31", slot: target, forecastText: "Thundery Showers" }],
      ENABLED,
    );

    expect(actions).toEqual([
      {
        type: "cancel",
        date: "2026-07-31",
        slot: target,
        notificationId: "notif-1",
      },
    ]);
  });

  it("never schedules for a muted slot", () => {
    const actions = planNotificationResync(
      [
        {
          date: "2026-07-31",
          slot: slot({ notificationsMuted: true }),
          forecastText: "Thundery Showers",
        },
      ],
      ENABLED,
    );

    expect(actions).toEqual([]);
  });

  it("cancels everything when rain alerts are switched off globally", () => {
    const target = slot({ notificationId: "notif-1" });
    const actions = planNotificationResync(
      [{ date: "2026-07-31", slot: target, forecastText: "Thundery Showers" }],
      { rainAlertsEnabled: false },
    );

    expect(actions.map((a) => a.type)).toEqual(["cancel"]);
  });

  it("keeps an existing alert when the forecast couldn't be loaded", () => {
    // A network blip must not silently strip an alert the user is relying on:
    // "unknown" is not "no rain".
    const actions = planNotificationResync(
      [
        {
          date: "2026-07-31",
          slot: slot({ notificationId: "notif-1" }),
          forecastText: null,
        },
      ],
      ENABLED,
    );

    expect(actions).toEqual([]);
  });

  it("schedules nothing when the forecast couldn't be loaded", () => {
    const actions = planNotificationResync(
      [{ date: "2026-07-31", slot: slot(), forecastText: null }],
      ENABLED,
    );

    expect(actions).toEqual([]);
  });

  it("still cancels a muted slot's alert even without a forecast", () => {
    // The mute is the user's own instruction — it doesn't depend on knowing
    // the weather, so it shouldn't wait on a successful fetch.
    const target = slot({ notificationId: "notif-1", notificationsMuted: true });
    const actions = planNotificationResync(
      [{ date: "2026-07-31", slot: target, forecastText: null }],
      ENABLED,
    );

    expect(actions).toEqual([
      {
        type: "cancel",
        date: "2026-07-31",
        slot: target,
        notificationId: "notif-1",
      },
    ]);
  });

  it("decides each slot independently", () => {
    const wet = slot({ id: "wet" });
    const cleared = slot({ id: "cleared", notificationId: "notif-2" });

    const actions = planNotificationResync(
      [
        { date: "2026-07-31", slot: wet, forecastText: "Showers" },
        { date: "2026-07-31", slot: cleared, forecastText: "Cloudy" },
      ],
      ENABLED,
    );

    expect(actions).toEqual([
      { type: "schedule", date: "2026-07-31", slot: wet },
      {
        type: "cancel",
        date: "2026-07-31",
        slot: cleared,
        notificationId: "notif-2",
      },
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(planNotificationResync([], ENABLED)).toEqual([]);
  });
});
