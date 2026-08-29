import { renderHook } from "@testing-library/react-native";

import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { getForecastForSlotByProvider } from "@/services/forecastProvider";
import {
  cancelNotification,
  scheduleRainNotification,
} from "@/services/notifications";
import { useItineraryStore } from "@/store/itineraryStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ItinerarySlot } from "@/types/itinerary";

jest.mock("@/services/forecastProvider", () => ({
  getForecastForSlotByProvider: jest.fn(),
}));
jest.mock("@/services/notifications", () => ({
  scheduleRainNotification: jest.fn(),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/services/itinerarySync", () => ({
  writeSlot: jest.fn(),
  writeSlotFields: jest.fn(),
  deleteSlotDoc: jest.fn(),
}));

const mockGetForecast = getForecastForSlotByProvider as jest.Mock;
const mockSchedule = scheduleRainNotification as jest.Mock;
const mockCancel = cancelNotification as jest.Mock;

/** Files a slot under a date, so the store has something to write the id onto. */
function seed(date: string, slot: ItinerarySlot) {
  useItineraryStore.setState({ plans: [{ id: date, date, slots: [slot] }] });
}

function makeSlot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "slot-1",
    label: "Walk",
    location: "Somewhere",
    neaRegion: "central",
    latitude: 1.3,
    longitude: 103.8,
    startTime: "2026-08-17T15:00:00+08:00",
    endTime: "2026-08-17T16:00:00+08:00",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetForecast.mockResolvedValue({ forecast: "Cloudy", source: "24hr" });
  mockSchedule.mockResolvedValue(null);
  useItineraryStore.setState({ plans: [] });
  useSettingsStore.setState({
    rainAlertsEnabled: true,
    rainLeadMinutes: 45,
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
  });
});

describe("useRainNotificationScheduler", () => {
  it("resolves an NEA slot's provider as 'nea' when calling the dispatcher", async () => {
    const { result } = await renderHook(() => useRainNotificationScheduler());
    const slot = makeSlot({ provider: "nea" });

    await result.current("2026-08-17", slot);

    expect(mockGetForecast).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "nea", region: "central" }),
    );
  });

  it("routes an overseas slot to Open-Meteo, not NEA's central-region fallback", async () => {
    const { result } = await renderHook(() => useRainNotificationScheduler());
    const slot = makeSlot({
      provider: "openMeteo",
      latitude: 13.7563,
      longitude: 100.5018,
    });

    await result.current("2026-08-17", slot);

    expect(mockGetForecast).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openMeteo",
        latitude: 13.7563,
        longitude: 100.5018,
      }),
    );
  });

  it("treats a slot with no provider field as 'nea' — the pre-existing behaviour", async () => {
    const { result } = await renderHook(() => useRainNotificationScheduler());
    const slot = makeSlot();
    delete slot.provider;

    await result.current("2026-08-17", slot);

    expect(mockGetForecast).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "nea" }),
    );
  });

  it("persists the handle on the slot the alert was scheduled for", async () => {
    const slot = makeSlot();
    seed("2026-08-17", slot);
    mockSchedule.mockResolvedValueOnce("notif-1");
    const { result } = await renderHook(() => useRainNotificationScheduler());

    await result.current("2026-08-17", slot);

    const stored = useItineraryStore.getState().plans[0].slots[0];
    expect(stored.notificationId).toBe("notif-1");
    expect(stored.notificationLeadMinutes).toBe(45);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("cancels rather than persists when the stop was muted while the forecast was in flight", async () => {
    // A swipe-to-mute lands during the fetch. `scheduleRainNotification` read
    // the muted flag off the copy it was handed, so it scheduled anyway — and
    // an id that never reaches a slot is an alert nothing can cancel later,
    // because `planNotificationResync` finds them through `notificationId`.
    const slot = makeSlot();
    seed("2026-08-17", slot);
    mockSchedule.mockImplementationOnce(async () => {
      useItineraryStore
        .getState()
        .updateSlot("2026-08-17", slot.id, { notificationsMuted: true });
      return "notif-1";
    });
    const { result } = await renderHook(() => useRainNotificationScheduler());

    await result.current("2026-08-17", slot);

    expect(mockCancel).toHaveBeenCalledWith("notif-1");
    expect(
      useItineraryStore.getState().plans[0].slots[0].notificationId,
    ).toBeUndefined();
  });

  it("cancels rather than persists when the stop was deleted or re-keyed meanwhile", async () => {
    // A "this day only" detach mints a fresh id, so the slot this call knows
    // about is gone by the time the fetch resolves.
    const slot = makeSlot();
    seed("2026-08-17", slot);
    mockSchedule.mockImplementationOnce(async () => {
      useItineraryStore.getState().deleteSlot("2026-08-17", slot.id);
      return "notif-1";
    });
    const { result } = await renderHook(() => useRainNotificationScheduler());

    await result.current("2026-08-17", slot);

    expect(mockCancel).toHaveBeenCalledWith("notif-1");
  });

  it("does nothing when rain alerts are off", async () => {
    useSettingsStore.setState({ rainAlertsEnabled: false });
    const { result } = await renderHook(() => useRainNotificationScheduler());

    await result.current("2026-08-17", makeSlot());

    expect(mockGetForecast).not.toHaveBeenCalled();
  });
});
