import {
  cancelNotification,
  listScheduledAlerts,
  scheduleDigestNotification,
  scheduleRainNotification,
} from "@/services/notifications";
import {
  runNotificationSync,
  type NotificationSyncContext,
} from "@/services/notificationSync";
import {
  getForecastForSlot,
  type DayPlan,
  type ItinerarySlot,
} from "@brelly/core";

jest.mock("@brelly/core/services/weather", () => ({
  getForecastForSlot: jest.fn(),
}));

jest.mock("@/services/notifications", () => ({
  scheduleRainNotification: jest.fn(),
  scheduleDigestNotification: jest.fn(),
  cancelNotification: jest.fn(),
  listScheduledAlerts: jest.fn(),
}));

const mockGetForecast = getForecastForSlot as jest.Mock;
const mockListScheduled = listScheduledAlerts as jest.Mock;
const mockScheduleRain = scheduleRainNotification as jest.Mock;
const mockScheduleDigest = scheduleDigestNotification as jest.Mock;
const mockCancel = cancelNotification as jest.Mock;

// Fixed "now": 08:00 on 31 Jul 2026, local time.
const NOW = new Date(2026, 6, 31, 8, 0);

function slot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "s1",
    label: "Picnic",
    location: "East Coast Park, Singapore",
    neaRegion: "east",
    latitude: 1.3009,
    longitude: 103.9124,
    startTime: new Date(2026, 6, 31, 16, 0).toISOString(),
    endTime: new Date(2026, 6, 31, 18, 0).toISOString(),
    ...overrides,
  };
}

function plans(slots: ItinerarySlot[]): DayPlan[] {
  return [{ id: "p1", date: "2026-07-31", slots }];
}

function context(
  overrides: Partial<NotificationSyncContext> = {},
): NotificationSyncContext {
  return {
    plans: plans([slot()]),
    now: NOW,
    settings: {
      rainAlertsEnabled: true,
    rainLeadMinutes: 45,
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
      digest: { enabled: false, time: "07:30" },
    },
    digestNotificationId: null,
    updateSlot: jest.fn(),
    setDigestNotificationId: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetForecast.mockResolvedValue({ forecast: "Partly Cloudy", source: "24hr" });
  mockScheduleRain.mockResolvedValue("notif-new");
  mockScheduleDigest.mockResolvedValue("digest-new");
  // The real function returns a promise, and the sync attaches `.catch` to it.
  mockCancel.mockResolvedValue(undefined);
  mockListScheduled.mockResolvedValue([]);
});

const queuedRain = (id: string, slotId = "s1", leadMinutes = 45) => ({
  id,
  kind: "rain" as const,
  slotId,
  leadMinutes,
});

describe("runNotificationSync — rain alerts", () => {
  it("schedules an alert for rain that appeared since the slot was created", async () => {
    mockGetForecast.mockResolvedValue({
      forecast: "Thundery Showers",
      source: "24hr",
    });
    const ctx = context();

    await runNotificationSync(ctx);

    expect(mockScheduleRain).toHaveBeenCalledTimes(1);
    // The lead time is stamped alongside the id so a later change to the
    // setting can tell this alert is stale.
    expect(ctx.updateSlot).toHaveBeenCalledWith("2026-07-31", "s1", {
      notificationId: "notif-new",
      notificationLeadMinutes: 45,
    });
  });

  it("cancels an alert for rain that cleared", async () => {
    mockListScheduled.mockResolvedValue([queuedRain("notif-old")]);
    const ctx = context({ plans: plans([slot({ notificationId: "notif-old" })]) });

    await runNotificationSync(ctx);

    expect(mockCancel).toHaveBeenCalledWith("notif-old");
    expect(ctx.updateSlot).toHaveBeenCalledWith("2026-07-31", "s1", {
      notificationId: undefined,
    });
  });

  it("leaves an existing alert alone when rain is still forecast", async () => {
    mockGetForecast.mockResolvedValue({ forecast: "Light Rain", source: "2hr" });
    mockListScheduled.mockResolvedValue([queuedRain("notif-old")]);
    const ctx = context({
      plans: plans([
        slot({ notificationId: "notif-old", notificationLeadMinutes: 45 }),
      ]),
    });

    await runNotificationSync(ctx);

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockScheduleRain).not.toHaveBeenCalled();
    expect(ctx.updateSlot).not.toHaveBeenCalled();
  });

  it("keeps an existing alert when the forecast request failed", async () => {
    mockGetForecast.mockResolvedValue({
      forecast: "Couldn't load forecast",
      source: "error",
    });
    mockListScheduled.mockResolvedValue([queuedRain("notif-old")]);
    const ctx = context({
      plans: plans([
        slot({ notificationId: "notif-old", notificationLeadMinutes: 45 }),
      ]),
    });

    await runNotificationSync(ctx);

    expect(mockCancel).not.toHaveBeenCalled();
    expect(ctx.updateSlot).not.toHaveBeenCalled();
  });

  it("ignores slots that have already started", async () => {
    const past = slot({ id: "past", startTime: new Date(2026, 6, 31, 7, 0).toISOString() });
    await runNotificationSync(context({ plans: plans([past]) }));

    expect(mockGetForecast).not.toHaveBeenCalled();
    expect(mockScheduleRain).not.toHaveBeenCalled();
  });

  it("passes quiet hours through to the scheduler", async () => {
    mockGetForecast.mockResolvedValue({ forecast: "Showers", source: "24hr" });
    const quietHours = { enabled: true, start: "22:00", end: "07:00" };

    await runNotificationSync(
      context({
        settings: {
          rainAlertsEnabled: true,
          rainLeadMinutes: 45,
          quietHours,
          digest: { enabled: false, time: "07:30" },
        },
      }),
    );

    expect(mockScheduleRain).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { quietHours, leadMinutes: 45 },
    );
  });

  it("does not record a notification id when scheduling was suppressed", async () => {
    mockGetForecast.mockResolvedValue({ forecast: "Showers", source: "24hr" });
    mockScheduleRain.mockResolvedValue(null);
    const ctx = context();

    await runNotificationSync(ctx);

    expect(ctx.updateSlot).not.toHaveBeenCalled();
  });

  it("cancels everything when rain alerts are switched off", async () => {
    mockGetForecast.mockResolvedValue({ forecast: "Showers", source: "24hr" });
    mockListScheduled.mockResolvedValue([queuedRain("notif-old")]);
    const ctx = context({
      plans: plans([slot({ notificationId: "notif-old" })]),
      settings: {
        rainAlertsEnabled: false,
    rainLeadMinutes: 45,
        quietHours: { enabled: false, start: "22:00", end: "07:00" },
        digest: { enabled: false, time: "07:30" },
      },
    });

    await runNotificationSync(ctx);

    expect(mockCancel).toHaveBeenCalledWith("notif-old");
    expect(mockScheduleRain).not.toHaveBeenCalled();
  });
});

describe("runNotificationSync — the OS queue is the record", () => {
  const rainy = () =>
    mockGetForecast.mockResolvedValue({ forecast: "Showers", source: "24hr" });

  it("does not schedule a second alert for a stop that already has one queued, even when the store forgot it", async () => {
    // The store's handle lives in memory: a cold start (and, before the
    // carry-over fix, every cloud snapshot) drops it. This is the case that
    // used to add one more alert per stop on every pass.
    rainy();
    mockListScheduled.mockResolvedValue([queuedRain("notif-queued")]);
    const ctx = context({ plans: plans([slot()]) });

    await runNotificationSync(ctx);

    expect(mockScheduleRain).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
    // The store is corrected to point at the alert that really exists, so a
    // later mute or edit can cancel it.
    expect(ctx.updateSlot).toHaveBeenCalledWith("2026-07-31", "s1", {
      notificationId: "notif-queued",
      notificationLeadMinutes: 45,
    });
  });

  it("cancels every duplicate for a stop and keeps the one the store points at", async () => {
    rainy();
    mockListScheduled.mockResolvedValue([
      queuedRain("dup-1"),
      queuedRain("notif-mine"),
      queuedRain("dup-2"),
    ]);
    const ctx = context({
      plans: plans([
        slot({ notificationId: "notif-mine", notificationLeadMinutes: 45 }),
      ]),
    });

    await runNotificationSync(ctx);

    expect(mockCancel.mock.calls.map(([id]) => id).sort()).toEqual([
      "dup-1",
      "dup-2",
    ]);
    expect(mockScheduleRain).not.toHaveBeenCalled();
    expect(ctx.updateSlot).not.toHaveBeenCalled();
  });

  it("treats a store handle the OS no longer holds as no alert, and schedules afresh", async () => {
    rainy();
    const ctx = context({
      plans: plans([
        slot({ notificationId: "notif-gone", notificationLeadMinutes: 45 }),
      ]),
    });

    await runNotificationSync(ctx);

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockScheduleRain).toHaveBeenCalledTimes(1);
    expect(ctx.updateSlot).toHaveBeenLastCalledWith("2026-07-31", "s1", {
      notificationId: "notif-new",
      notificationLeadMinutes: 45,
    });
  });

  it("cancels an alert for a stop that no longer exists", async () => {
    mockListScheduled.mockResolvedValue([queuedRain("stray", "deleted-slot")]);

    await runNotificationSync(context({ plans: [] }));

    expect(mockCancel).toHaveBeenCalledWith("stray");
  });

  it("cancels alerts an older build queued without a tag", async () => {
    // There is no telling which stop they were for. The rainy stop gets a
    // tagged replacement in the same pass.
    rainy();
    mockListScheduled.mockResolvedValue([
      { id: "old-1", kind: "untagged" },
      { id: "old-2", kind: "untagged" },
    ]);

    await runNotificationSync(context());

    expect(mockCancel).toHaveBeenCalledWith("old-1");
    expect(mockCancel).toHaveBeenCalledWith("old-2");
    expect(mockScheduleRain).toHaveBeenCalledTimes(1);
  });

  it("reschedules when the queued alert was made against a different lead time", async () => {
    rainy();
    mockListScheduled.mockResolvedValue([queuedRain("notif-30", "s1", 30)]);

    await runNotificationSync(context({ plans: plans([slot()]) }));

    expect(mockCancel).toHaveBeenCalledWith("notif-30");
    expect(mockScheduleRain).toHaveBeenCalledTimes(1);
  });

  it("falls back to the store's handles when the queue cannot be read", async () => {
    mockListScheduled.mockRejectedValue(new Error("native module missing"));
    mockGetForecast.mockResolvedValue({ forecast: "Light Rain", source: "2hr" });
    const ctx = context({
      plans: plans([
        slot({ notificationId: "notif-old", notificationLeadMinutes: 45 }),
      ]),
    });

    await runNotificationSync(ctx);

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockScheduleRain).not.toHaveBeenCalled();
    expect(ctx.updateSlot).not.toHaveBeenCalled();
  });

  it("keeps going when a sweep cancel fails", async () => {
    rainy();
    mockCancel.mockRejectedValueOnce(new Error("gone already"));
    mockListScheduled.mockResolvedValue([{ id: "old", kind: "untagged" }]);

    await expect(runNotificationSync(context())).resolves.toBeUndefined();
    expect(mockScheduleRain).toHaveBeenCalledTimes(1);
  });
});

describe("runNotificationSync — daily digest", () => {
  const digestOn = (time = "07:30") => ({
    rainAlertsEnabled: true,
    rainLeadMinutes: 45,
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
    digest: { enabled: true, time },
  });

  it("schedules the digest for the next occurrence of the chosen time", async () => {
    // 08:00 now, digest at 07:30 → tomorrow. Give tomorrow a plan.
    const tomorrowSlot = slot({
      id: "tmr",
      startTime: new Date(2026, 7, 1, 10, 0).toISOString(),
    });
    const ctx = context({
      plans: [{ id: "p2", date: "2026-08-01", slots: [tomorrowSlot] }],
      settings: digestOn(),
    });

    await runNotificationSync(ctx);

    expect(mockScheduleDigest).toHaveBeenCalledWith(
      new Date(2026, 7, 1, 7, 30),
      expect.objectContaining({ body: expect.stringContaining("1 stop") }),
    );
    expect(ctx.setDigestNotificationId).toHaveBeenCalledWith("digest-new");
  });

  it("cancels the previous digest before scheduling a new one", async () => {
    const ctx = context({
      digestNotificationId: "digest-old",
      settings: digestOn(),
    });

    await runNotificationSync(ctx);

    expect(mockCancel).toHaveBeenCalledWith("digest-old");
  });

  it("cancels every digest the OS holds, including ones the store forgot", async () => {
    mockListScheduled.mockResolvedValue([
      { id: "digest-a", kind: "digest" },
      { id: "digest-b", kind: "digest" },
    ]);
    const ctx = context({ digestNotificationId: "digest-a", settings: digestOn() });

    await runNotificationSync(ctx);

    expect(mockCancel).toHaveBeenCalledWith("digest-a");
    expect(mockCancel).toHaveBeenCalledWith("digest-b");
    expect(mockCancel).toHaveBeenCalledTimes(2);
  });

  it("cancels the existing digest and schedules none when it is switched off", async () => {
    const ctx = context({ digestNotificationId: "digest-old" });

    await runNotificationSync(ctx);

    expect(mockCancel).toHaveBeenCalledWith("digest-old");
    expect(mockScheduleDigest).not.toHaveBeenCalled();
    expect(ctx.setDigestNotificationId).toHaveBeenCalledWith(null);
  });

  it("schedules nothing when the digest's day has no plans", async () => {
    // Digest fires tomorrow; the only plan is today.
    const ctx = context({ settings: digestOn() });

    await runNotificationSync(ctx);

    expect(mockScheduleDigest).not.toHaveBeenCalled();
  });

  it("reports rain in the digest body when a stop is wet", async () => {
    mockGetForecast.mockResolvedValue({
      forecast: "Thundery Showers",
      source: "24hr",
    });
    // Digest at 09:00 today (now is 08:00), covering today's 16:00 picnic.
    const ctx = context({ settings: digestOn("09:00") });

    await runNotificationSync(ctx);

    expect(mockScheduleDigest).toHaveBeenCalledWith(
      new Date(2026, 6, 31, 9, 0),
      expect.objectContaining({
        title: "Umbrella today",
        body: expect.stringContaining("Picnic"),
      }),
    );
  });

  it("does not schedule a digest for a malformed time", async () => {
    const ctx = context({ settings: digestOn("not a time") });

    await runNotificationSync(ctx);

    expect(mockScheduleDigest).not.toHaveBeenCalled();
  });
});
