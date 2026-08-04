import {
  cancelNotification,
  scheduleDigestNotification,
  scheduleRainNotification,
} from "@/services/notifications";
import {
  runNotificationSync,
  type NotificationSyncContext,
} from "@/services/notificationSync";
import { getForecastForSlot } from "@/services/weather";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest.fn(),
}));

jest.mock("@/services/notifications", () => ({
  scheduleRainNotification: jest.fn(),
  scheduleDigestNotification: jest.fn(),
  cancelNotification: jest.fn(),
}));

const mockGetForecast = getForecastForSlot as jest.Mock;
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
    const ctx = context({ plans: plans([slot({ notificationId: "notif-old" })]) });

    await runNotificationSync(ctx);

    expect(mockCancel).toHaveBeenCalledWith("notif-old");
    expect(ctx.updateSlot).toHaveBeenCalledWith("2026-07-31", "s1", {
      notificationId: undefined,
    });
  });

  it("leaves an existing alert alone when rain is still forecast", async () => {
    mockGetForecast.mockResolvedValue({ forecast: "Light Rain", source: "2hr" });
    const ctx = context({ plans: plans([slot({ notificationId: "notif-old" })]) });

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
    const ctx = context({ plans: plans([slot({ notificationId: "notif-old" })]) });

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
