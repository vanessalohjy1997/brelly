import * as Notifications from "expo-notifications";

import {
  cancelAndDeleteSlot,
  cancelNotification,
  configureNotificationHandler,
  countScheduledNotifications,
  listScheduledAlerts,
  scheduleDigestNotification,
  scheduleRainNotification,
  sendTestNotification,
  TEST_NOTIFICATION_DELAY_SECONDS,
} from "@/services/notifications";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval" },
  AndroidImportance: { DEFAULT: 3 },
}));

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockGetAllScheduled =
  Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const mockSetHandler = Notifications.setNotificationHandler as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scheduleRainNotification", () => {
  beforeEach(() => {
    mockGetPermissions.mockResolvedValue({ granted: true });
  });

  const futureSlot = () => ({
    id: "slot-lunch",
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
      id: "slot-soon",
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
      { id: "slot-run", label: "Sunrise run", startTime: start.toISOString() },
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
      { id: "slot-picnic", label: "Picnic", startTime: start.toISOString() },
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
      { id: "slot-run", label: "Sunrise run", startTime: start.toISOString() },
      { forecast: "Showers", source: "24hr" },
      { quietHours: { enabled: false, start: "22:00", end: "07:00" } },
    );

    expect(result).toBe("notif-night");
  });

  it("tags the alert with its stop and lead time, so the sync can read the queue back", async () => {
    // The store's handle is forgotten on every cold start; the tag is what
    // lets the next sync see this alert already exists instead of queueing
    // a second one.
    mockSchedule.mockResolvedValue("notif-tagged");

    await scheduleRainNotification(
      futureSlot(),
      { forecast: "Showers", source: "24hr" },
      { leadMinutes: 30 },
    );

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { kind: "rain", slotId: "slot-lunch", leadMinutes: 30 },
        }),
      }),
    );
  });

  it("leaves the lead time off the tag when none was given", async () => {
    mockSchedule.mockResolvedValue("notif-default-lead");

    await scheduleRainNotification(futureSlot(), {
      forecast: "Showers",
      source: "24hr",
    });

    expect(mockSchedule.mock.calls[0][0].content.data).toEqual({
      kind: "rain",
      slotId: "slot-lunch",
    });
  });

  it("honours a custom lead time", async () => {
    mockSchedule.mockResolvedValue("notif-lead");
    const start = new Date(Date.now() + 20 * 60 * 1000);

    // The 45-minute default would already have passed for a slot 20 minutes
    // out; a 10-minute lead is still schedulable.
    const result = await scheduleRainNotification(
      { id: "slot-walk", label: "Walk", startTime: start.toISOString() },
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
        content: {
          title: "Umbrella today",
          body: "2 stops, rain expected.",
          data: { kind: "digest" },
        },
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

describe("sendTestNotification", () => {
  it("schedules one alert a few seconds out", async () => {
    // Not immediately: a notification fired while the app is in the
    // foreground may not present a banner at all, so an alert that works
    // would look broken.
    mockGetPermissions.mockResolvedValue({ granted: true });

    const sent = await sendTestNotification();

    expect(sent).toBe(true);
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        // Tagged so a sync's sweep does not cancel it while it waits.
        content: expect.objectContaining({ data: { kind: "test" } }),
        trigger: expect.objectContaining({
          type: "timeInterval",
          seconds: TEST_NOTIFICATION_DELAY_SECONDS,
          repeats: false,
        }),
      }),
    );
  });

  it("reports failure rather than claiming a send when permission is refused", async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    mockRequestPermissions.mockResolvedValue({ granted: false });

    const sent = await sendTestNotification();

    expect(sent).toBe(false);
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

describe("configureNotificationHandler", () => {
  it("tells the OS to show a banner in the foreground, where it is otherwise suppressed", async () => {
    configureNotificationHandler();

    expect(mockSetHandler).toHaveBeenCalledTimes(1);
    const { handleNotification } = mockSetHandler.mock.calls[0][0];
    // v57 replaced shouldShowAlert with shouldShowBanner/shouldShowList; a
    // handler missing these leaves foreground alerts silent.
    await expect(handleNotification()).resolves.toEqual({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });
});

describe("countScheduledNotifications", () => {
  it("counts what the OS actually has queued", () => {
    // "Rain alerts: on" says what the app intends; this says what is really
    // waiting to be delivered, and the two come apart routinely.
    mockGetAllScheduled.mockResolvedValue([{ identifier: "a" }, { identifier: "b" }]);

    return expect(countScheduledNotifications()).resolves.toBe(2);
  });

  it("is zero when nothing is queued", () => {
    mockGetAllScheduled.mockResolvedValue([]);

    return expect(countScheduledNotifications()).resolves.toBe(0);
  });
});

describe("listScheduledAlerts", () => {
  const request = (identifier: string, data?: Record<string, unknown>) => ({
    identifier,
    content: { title: "x", body: "y", data },
    trigger: { type: "date" },
  });

  it("reads each rain alert back with the stop and lead time it was tagged with", async () => {
    mockGetAllScheduled.mockResolvedValue([
      request("r1", { kind: "rain", slotId: "s1", leadMinutes: 45 }),
      request("r2", { kind: "rain", slotId: "s2" }),
    ]);

    await expect(listScheduledAlerts()).resolves.toEqual([
      { id: "r1", kind: "rain", slotId: "s1", leadMinutes: 45 },
      { id: "r2", kind: "rain", slotId: "s2" },
    ]);
  });

  it("reads a digest back as a digest", async () => {
    mockGetAllScheduled.mockResolvedValue([request("d1", { kind: "digest" })]);

    await expect(listScheduledAlerts()).resolves.toEqual([
      { id: "d1", kind: "digest" },
    ]);
  });

  it("reports an alert from before the tags existed as untagged", async () => {
    // Nothing says which stop it was for, so the sync cancels it and lets
    // the next pass schedule a tagged replacement.
    mockGetAllScheduled.mockResolvedValue([
      request("old-1"),
      request("old-2", { kind: "rain" }),
      request("old-3", { kind: "rain", slotId: 7 }),
    ]);

    await expect(listScheduledAlerts()).resolves.toEqual([
      { id: "old-1", kind: "untagged" },
      { id: "old-2", kind: "untagged" },
      { id: "old-3", kind: "untagged" },
    ]);
  });

  it("leaves the test alert out", async () => {
    mockGetAllScheduled.mockResolvedValue([request("t1", { kind: "test" })]);

    await expect(listScheduledAlerts()).resolves.toEqual([]);
  });
});
