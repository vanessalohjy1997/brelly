import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import TodayScreen from "@/app/(tabs)/index";
import { useItineraryStore } from "@/store/itineraryStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { todayKey } from "@/utils/dateKeys";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest
    .fn()
    .mockResolvedValue({ forecast: "Cloudy", source: "24hr" }),
  getUpcomingForecast: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/services/liveConditions", () => ({
  getLiveConditions: jest.fn().mockResolvedValue({
    stationName: "Tanjong Rhu",
    observedAt: new Date().toISOString(),
    rainfallMm: 0,
    temperatureC: 30,
  }),
}));

jest.mock("@/services/airQuality", () => ({
  fetchPsi: jest.fn().mockResolvedValue({
    updatedTimestamp: new Date().toISOString(),
    psi: { north: 52, south: 51, east: 52, west: 52, central: 57 },
    pm25: { north: 13, south: 12, east: 13, west: 13, central: 18 },
  }),
  fetchUvIndex: jest.fn().mockResolvedValue({
    updatedTimestamp: new Date().toISOString(),
    value: 8,
    hour: new Date().toISOString(),
  }),
}));

function slot(id: string, label: string, hour: number): ItinerarySlot {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    id,
    label,
    location: "East Coast Park, Singapore",
    neaRegion: "east",
    latitude: 1.3009,
    longitude: 103.9124,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function todaysPlan(slots: ItinerarySlot[]): DayPlan {
  return { id: "today", date: todayKey(), slots };
}

beforeEach(() => {
  jest.clearAllMocks();
  useItineraryStore.setState({ plans: [] });
});

describe("TodayScreen", () => {
  it("shows the empty state when nothing is planned today", async () => {
    const view = await renderWithProviders(<TodayScreen />);

    expect(view.getByText("No plans yet")).toBeTruthy();
  });

  it("navigates to the add-plan screen from the empty state", async () => {
    const view = await renderWithProviders(<TodayScreen />);

    await fireEvent.press(view.getByText("+ Add a plan"));

    expect(router.push).toHaveBeenCalledWith("/plan/new");
  });

  it("navigates to the add-plan screen from the header", async () => {
    const view = await renderWithProviders(<TodayScreen />);

    await fireEvent.press(view.getByText("+ Add"));

    expect(router.push).toHaveBeenCalledWith("/plan/new");
  });

  it("lists today's slots instead of the empty state", async () => {
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", 7)])],
    });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.getByText("Morning run")).toBeTruthy();
    expect(view.queryByText("No plans yet")).toBeNull();
  });

  it("ignores plans belonging to another day", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    useItineraryStore.setState({
      plans: [
        {
          id: "tmr",
          date: todayKey(tomorrow),
          slots: [slot("s1", "Tomorrow's picnic", 12)],
        },
      ],
    });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.getByText("No plans yet")).toBeTruthy();
  });

  it("navigates to a slot when its card is tapped", async () => {
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", 7)])],
    });
    const view = await renderWithProviders(<TodayScreen />);

    await fireEvent.press(view.getByText("Morning run"));

    expect(router.push).toHaveBeenCalledWith("/plan/s1");
  });

  it("shows live conditions for the day's stop", async () => {
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", 7)])],
    });
    const view = await renderWithProviders(<TodayScreen />);

    expect(await view.findByText("Right now")).toBeTruthy();
    expect(await view.findByText("30°C")).toBeTruthy();
  });

  it("re-renders when a plan is added to the store", async () => {
    // The screen previously subscribed to a store *getter*, whose identity
    // never changes — so it never re-rendered when plans did.
    const view = await renderWithProviders(<TodayScreen />);
    expect(view.getByText("No plans yet")).toBeTruthy();

    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Added later", 15)])],
    });

    expect(await view.findByText("Added later")).toBeTruthy();
  });
});
