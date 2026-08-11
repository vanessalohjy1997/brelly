import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import HistoryScreen from "@/app/(tabs)/history";
import { getForecastForSlot } from "@/services/weather";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useToastStore } from "@/store/toastStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { toDateKey } from "@/utils/dateKeys";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest
    .fn()
    .mockResolvedValue({ forecast: "Cloudy", source: "24hr" }),
  getUpcomingForecast: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/services/airQuality", () => ({
  fetchUvIndex: jest.fn().mockResolvedValue({
    updatedTimestamp: new Date().toISOString(),
    value: 8,
    hour: new Date().toISOString(),
  }),
}));

function slot(
  id: string,
  label: string,
  offsetDays: number,
  hour = 12,
): ItinerarySlot {
  const start = new Date();
  start.setDate(start.getDate() + offsetDays);
  start.setHours(hour, 0, 0, 0);

  return {
    id,
    label,
    location: "Somewhere, Singapore",
    neaRegion: "central",
    latitude: 1.3521,
    longitude: 103.8198,
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
  };
}

/** A stop that ended an hour ago — today's date, but already history. */
function finishedEarlierToday(id: string, label: string): ItinerarySlot {
  const end = new Date(Date.now() - 60 * 60 * 1000);
  return {
    ...slot(id, label, 0),
    startTime: new Date(end.getTime() - 60 * 60 * 1000).toISOString(),
    endTime: end.toISOString(),
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
  useToastStore.setState({ toast: null, modalHosts: [] });
  useCloudSyncStore.setState({
    settingsReady: true,
    routinesReady: true,
    slotsReady: true,
  });
});

describe("HistoryScreen", () => {
  it("shows a loading skeleton before the cloud data is ready", async () => {
    useCloudSyncStore.setState({ slotsReady: false });

    const view = await renderWithProviders(<HistoryScreen />);

    expect(view.getByText("Loading your history…")).toBeTruthy();
    expect(view.queryByText("Nothing here yet")).toBeNull();
  });

  it("titles itself and explains when nothing has passed yet", async () => {
    const view = await renderWithProviders(<HistoryScreen />);

    expect(view.getByText("History")).toBeTruthy();
    expect(view.getByText("Nothing here yet")).toBeTruthy();
  });

  it("lists stops that have finished", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch", -2)])],
    });

    const view = await renderWithProviders(<HistoryScreen />);

    expect(view.getByText("Last week's lunch")).toBeTruthy();
  });

  it("leaves upcoming stops to the Plans tab", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(1, [slot("soon", "Picnic", 1)])],
    });

    const view = await renderWithProviders(<HistoryScreen />);

    expect(view.queryByText("Picnic")).toBeNull();
    expect(view.getByText("Nothing here yet")).toBeTruthy();
  });

  it("takes today's finished stops, not just whole past days", async () => {
    useItineraryStore.setState({
      plans: [
        dayPlan(0, [
          finishedEarlierToday("done", "Shopping"),
          slot("later", "Dinner", 0, 23),
        ]),
      ],
    });

    const view = await renderWithProviders(<HistoryScreen />);

    expect(view.getByText("Shopping")).toBeTruthy();
    expect(view.queryByText("Dinner")).toBeNull();
    // Under a heading that names the day rather than dating it.
    expect(view.getByText("Today")).toBeTruthy();
  });

  it("heads each day and puts the most recent first", async () => {
    useItineraryStore.setState({
      plans: [
        dayPlan(-5, [slot("older", "Museum", -5)]),
        dayPlan(-1, [slot("newer", "Market", -1)]),
      ],
    });

    const view = await renderWithProviders(<HistoryScreen />);

    expect(
      view.getAllByText(/^(Yesterday|Museum|Market)$/).map((n) => n.props.children),
    ).toEqual(["Yesterday", "Market", "Museum"]);
  });

  it("asks for no forecast — there is none for a time that has passed", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch", -2)])],
    });

    const view = await renderWithProviders(<HistoryScreen />);

    expect(view.getByText("Last week's lunch")).toBeTruthy();
    expect(getForecastForSlot).not.toHaveBeenCalled();
    expect(view.queryByText("No forecast")).toBeNull();
    expect(view.queryByText("Checking the sky…")).toBeNull();
  });

  it("opens a past stop for editing", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch", -2)])],
    });

    const view = await renderWithProviders(<HistoryScreen />);
    await fireEvent.press(view.getByText("Last week's lunch"));

    expect(router.push).toHaveBeenCalledWith("/plan/old");
  });

  it("deletes a past stop, so the archive can be cleared", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch", -2)])],
    });

    const view = await renderWithProviders(<HistoryScreen />);
    await fireEvent.press(view.getByLabelText("Delete plan"));

    expect(useItineraryStore.getState().plans).toHaveLength(0);
    expect(useToastStore.getState().toast).toMatchObject({
      message: "Deleted Last week's lunch",
      variant: "success",
    });
  });
});
