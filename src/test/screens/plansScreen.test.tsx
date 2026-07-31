import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import PlansScreen from "@/app/(tabs)/plans";
import { useItineraryStore } from "@/store/itineraryStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { toDateKey } from "@/utils/dateKeys";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest
    .fn()
    .mockResolvedValue({ forecast: "Cloudy", source: "24hr" }),
  getUpcomingForecast: jest.fn().mockResolvedValue([]),
}));

function slot(id: string, label: string): ItinerarySlot {
  return {
    id,
    label,
    location: "Somewhere, Singapore",
    neaRegion: "central",
    latitude: 1.3521,
    longitude: 103.8198,
    startTime: new Date(2026, 6, 31, 12, 0).toISOString(),
    endTime: new Date(2026, 6, 31, 13, 0).toISOString(),
  };
}

function dayPlan(offsetDays: number, slots: ItinerarySlot[]): DayPlan {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return { id: `p${offsetDays}`, date: toDateKey(date), slots };
}

beforeEach(() => {
  jest.clearAllMocks();
  useItineraryStore.setState({ plans: [] });
});

describe("PlansScreen", () => {
  it("shows the empty state when there are no plans", async () => {
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.getByText("Nothing planned")).toBeTruthy();
  });

  it("navigates to the add-plan screen from the empty state", async () => {
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("+ Add a plan"));

    expect(router.push).toHaveBeenCalledWith("/plan/new");
  });

  it("navigates to the add-plan screen from the header", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic")])] });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("+ Add"));

    expect(router.push).toHaveBeenCalledWith("/plan/new");
  });

  it("navigates to settings from the header", async () => {
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByLabelText("Settings"));

    expect(router.push).toHaveBeenCalledWith("/settings");
  });

  it("lists upcoming plans", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic")])] });
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.getByText("Picnic")).toBeTruthy();
  });

  it("hides past plans behind a toggle rather than deleting them", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch")])],
    });
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.queryByText("Last week's lunch")).toBeNull();
    expect(view.getByText("Show 1 past plan")).toBeTruthy();
  });

  it("reveals past plans when the toggle is pressed", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch")])],
    });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("Show 1 past plan"));

    expect(view.getByText("Last week's lunch")).toBeTruthy();
    expect(view.getByText("Hide past plans")).toBeTruthy();
  });

  it("pluralises the past-plans toggle", async () => {
    useItineraryStore.setState({
      plans: [
        dayPlan(-2, [slot("old1", "A")]),
        dayPlan(-3, [slot("old2", "B")]),
      ],
    });
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.getByText("Show 2 past plans")).toBeTruthy();
  });

  it("navigates to a plan when its card is tapped", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic")])] });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("Picnic"));

    expect(router.push).toHaveBeenCalledWith("/plan/s1");
  });

  it("removes a slot from the store when its delete action is used", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic")])] });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("Delete"));

    expect(useItineraryStore.getState().plans).toHaveLength(0);
  });
});
