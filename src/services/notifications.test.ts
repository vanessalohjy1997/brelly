import * as Notifications from "expo-notifications";

import {
  cancelAndDeleteSlot,
  cancelNotification,
  scheduleDigestNotification,
  scheduleRainNotification,
} from "@/services/notifications";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { DEFAULT: 3 },
}));

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scheduleRainNotification", () => {
  beforeEach(() => {
    mockGetPermissions.mockResolvedValue({ granted: true });
  });

  const futureSlot = () => ({
    label: "Lunch with Sam",
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });

  it("does not schedule when the forecast isn't rainy", async () => {
    const result = await scheduleRainNotification(futureSlot(), {
      forecast: "Fair and Warm",
      source: "24hr",
    });

    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("does not schedule when the lead time has already passed", async () => {
    const soonSlot = {
      label: "Lunch",
      startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    const result = await scheduleRainNotification(soonSlot, {
      forecast: "Heavy Thundery Showers",
      source: "24hr",
    });

    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("does not schedule when permission is denied", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    mockRequestPermissions.mockResolvedValue({ granted: false });

    const result = await scheduleRainNotification(futureSlot(), {
      forecast: "Showers",
      source: "24hr",
    });

    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("requests permission when not already granted, and schedules if the user allows it", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockSchedule.mockResolvedValue("notif-1");

    const result = await scheduleRainNotification(futureSlot(), {
      forecast: "Showers",
      source: "24hr",
    });

    expect(mockRequestPermissions).toHaveBeenCalled();
    expect(result).toBe("notif-1");
  });

  it("schedules a notification when rain is forecast, lead time hasn't passed, and permission is granted", async () => {
    mockSchedule.mockResolvedValue("notif-abc");

    const result = await scheduleRainNotification(futureSlot(), {
      forecast: "Thundery Showers",
      source: "24hr",
    });

    expect(result).toBe("notif-abc");
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: expect.stringContaining("Thundery Showers"),
        }),
        trigger: expect.objectContaining({ type: "date" }),
      }),
    );
  });

  it("does not schedule for a slot the user muted", async () => {
    const result = await scheduleRainNotification(
      { ...futureSlot(), notificationsMuted: true },
      { forecast: "Thundery Showers", source: "24hr" },
    );

    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("suppresses an alert that would fire inside quiet hours", async () => {
    // Slot starts at 06:00 local, so the 45-minute lead lands at 05:15 —
    // inside a 22:00–07:00 quiet window.
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(6, 0, 0, 0);

    const result = await scheduleRainNotification(
      { label: "Sunrise run", startTime: start.toISOString() },
      { forecast: "Showers", source: "24hr" },
      { quietHours: { enabled: true, start: "22:00", end: "07:00" } },
    );

    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("still schedules when the alert lands outside quiet hours", async () => {
    mockSchedule.mockResolvedValue("notif-day");
    // 14:00 start → 13:15 alert, well clear of a 22:00–07:00 window.
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(14, 0, 0, 0);

    const result = await scheduleRainNotification(
      { label: "Picnic", startTime: start.toISOString() },
      { forecast: "Showers", source: "24hr" },
      { quietHours: { enabled: true, start: "22:00", end: "07:00" } },
    );

    expect(result).toBe("notif-day");
  });

  it("ignores a quiet window that is switched off", async () => {
    mockSchedule.mockResolvedValue("notif-night");
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(6, 0, 0, 0);

    const result = await scheduleRainNotification(
      { label: "Sunrise run", startTime: start.toISOString() },
      { forecast: "Showers", source: "24hr" },
      { quietHours: { enabled: false, start: "22:00", end: "07:00" } },
    );

    expect(result).toBe("notif-night");
  });

  it("honours a custom lead time", async () => {
    mockSchedule.mockResolvedValue("notif-lead");
    const start = new Date(Date.now() + 20 * 60 * 1000);

    // The 45-minute default would already have passed for a slot 20 minutes
    // out; a 10-minute lead is still schedulable.
    const result = await scheduleRainNotification(
      { label: "Walk", startTime: start.toISOString() },
      { forecast: "Showers", source: "24hr" },
      { leadMinutes: 10 },
    );

    expect(result).toBe("notif-lead");
  });
});

describe("scheduleDigestNotification", () => {
  beforeEach(() => {
    mockGetPermissions.mockResolvedValue({ granted: true });
  });

  const message = { title: "Umbrella today", body: "2 stops, rain expected." };

  it("schedules the digest at the given moment", async () => {
    mockSchedule.mockResolvedValue("digest-1");
    const triggerDate = new Date(Date.now() + 6 * 60 * 60 * 1000);

    const result = await scheduleDigestNotification(triggerDate, message);

    expect(result).toBe("digest-1");
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { title: "Umbrella today", body: "2 stops, rain expected." },
        trigger: expect.objectContaining({ type: "date", date: triggerDate }),
      }),
    );
  });

  it("does not schedule a trigger that has already passed", async () => {
    const result = await scheduleDigestNotification(
      new Date(Date.now() - 60 * 1000),
      message,
    );

    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("does not schedule when permission is denied", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    mockRequestPermissions.mockResolvedValue({ granted: false });

    const result = await scheduleDigestNotification(
      new Date(Date.now() + 60 * 60 * 1000),
      message,
    );

    expect(result).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

describe("cancelNotification", () => {
  it("delegates to expo-notifications", async () => {
    await cancelNotification("notif-1");
    expect(mockCancel).toHaveBeenCalledWith("notif-1");
  });
});

describe("cancelAndDeleteSlot", () => {
  it("deletes the slot and cancels its notification when one exists", () => {
    const deleteSlot = jest.fn();
    cancelAndDeleteSlot(deleteSlot, "2026-07-30", {
      id: "slot-1",
      notificationId: "notif-1",
    });

    expect(deleteSlot).toHaveBeenCalledWith("2026-07-30", "slot-1");
    expect(mockCancel).toHaveBeenCalledWith("notif-1");
  });

  it("deletes the slot without attempting cancellation when there's no notification", () => {
    const deleteSlot = jest.fn();
    cancelAndDeleteSlot(deleteSlot, "2026-07-30", { id: "slot-1" });

    expect(deleteSlot).toHaveBeenCalledWith("2026-07-30", "slot-1");
    expect(mockCancel).not.toHaveBeenCalled();
  });
});
