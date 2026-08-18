import { renderHook } from "@testing-library/react-native";

import { useRainNotificationScheduler } from "@/hooks/useRainNotificationScheduler";
import { getForecastForSlotByProvider } from "@/services/forecastProvider";
import { scheduleRainNotification } from "@/services/notifications";
import { useItineraryStore } from "@/store/itineraryStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ItinerarySlot } from "@/types/itinerary";

jest.mock("@/services/forecastProvider", () => ({
  getForecastForSlotByProvider: jest.fn(),
}));
jest.mock("@/services/notifications", () => ({
  scheduleRainNotification: jest.fn(),
}));
jest.mock("@/services/itinerarySync", () => ({
  writeSlot: jest.fn(),
  writeSlotFields: jest.fn(),
  deleteSlotDoc: jest.fn(),
}));

const mockGetForecast = getForecastForSlotByProvider as jest.Mock;
const mockSchedule = scheduleRainNotification as jest.Mock;

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

  it("does nothing when rain alerts are off", async () => {
    useSettingsStore.setState({ rainAlertsEnabled: false });
    const { result } = await renderHook(() => useRainNotificationScheduler());

    await result.current("2026-08-17", makeSlot());

    expect(mockGetForecast).not.toHaveBeenCalled();
  });
});
