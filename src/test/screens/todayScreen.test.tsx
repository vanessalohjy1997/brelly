import { act, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import TodayScreen from "@/app/(tabs)/index";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useItineraryStore } from "@/store/itineraryStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useToastStore } from "@/store/toastStore";
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

/**
 * Positioned relative to *now*, not at a fixed hour of the day. The screen
 * drops a stop the minute it ends, so a fixture pinned to 07:00 would be an
 * upcoming stop before breakfast and an archived one after it — the test would
 * pass or fail depending on when it ran.
 */
function slot(
  id: string,
  label: string,
  minutesFromNow: number,
): ItinerarySlot {
  const start = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

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
  useSettingsStore.setState({ hasSeenOnboarding: true });
  useToastStore.setState({ toast: null, modalHosts: [] });
  useCloudSyncStore.setState({
    settingsReady: true,
    routinesReady: true,
    slotsReady: true,
  });
});

describe("TodayScreen", () => {
  it("shows a loading skeleton before the cloud data is ready", async () => {
    useCloudSyncStore.setState({ slotsReady: false });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.getByText("Loading your plans…")).toBeTruthy();
    expect(view.queryByText("No plans yet")).toBeNull();
  });

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
      plans: [todaysPlan([slot("s1", "Morning run", 30)])],
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
          slots: [slot("s1", "Tomorrow's picnic", 30)],
        },
      ],
    });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.getByText("No plans yet")).toBeTruthy();
  });

  it("drops a stop from the list the moment it has ended", async () => {
    useItineraryStore.setState({
      plans: [
        todaysPlan([
          slot("done", "Shopping", -120),
          slot("next", "Dinner", 60),
        ]),
      ],
    });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.queryByText("Shopping")).toBeNull();
    expect(view.getByText("Dinner")).toBeTruthy();
  });

  it("says the day is done rather than that nothing was planned", async () => {
    // The distinction matters: "No plans yet" after a full day of stops reads
    // as data loss, when in fact they have all just moved to Past plans.
    useItineraryStore.setState({
      plans: [todaysPlan([slot("done", "Shopping", -120)])],
    });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.getByText("Nothing left today")).toBeTruthy();
    expect(view.queryByText("No plans yet")).toBeNull();
    expect(view.queryByText("Shopping")).toBeNull();
  });

  it("navigates to a slot when its card is tapped", async () => {
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", 30)])],
    });
    const view = await renderWithProviders(<TodayScreen />);

    await fireEvent.press(view.getByText("Morning run"));

    expect(router.push).toHaveBeenCalledWith("/plan/s1");
  });

  it("shows live conditions for the day's stop", async () => {
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", 30)])],
    });
    const view = await renderWithProviders(<TodayScreen />);

    expect(await view.findByText("Right now")).toBeTruthy();
    expect(await view.findByText("30°C")).toBeTruthy();
  });

  it("lists the day in chronological order, whatever order it is stored in", async () => {
    useItineraryStore.setState({
      plans: [
        todaysPlan([
          slot("s3", "Dinner", 180),
          slot("s1", "Morning run", 30),
          slot("s2", "Lunch", 90),
        ]),
      ],
    });

    const view = await renderWithProviders(<TodayScreen />);

    // `getAllByText` returns matches in tree order, so this is the order the
    // cards actually appear in — not just that all three are present.
    expect(
      view
        .getAllByText(/^(Morning run|Lunch|Dinner)$/)
        .map((node) => node.props.children),
    ).toEqual(["Morning run", "Lunch", "Dinner"]);
  });

  it("offers no way to rearrange the day", async () => {
    // Drag-to-reorder produced an order that contradicted the clock and the
    // Plans tab; the list is a timeline now and the handle is gone with it.
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", 30)])],
    });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.queryByLabelText("Drag to reorder")).toBeNull();
  });

  it("confirms a deleted plan", async () => {
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", 30)])],
    });
    const view = await renderWithProviders(<TodayScreen />);

    await fireEvent.press(view.getByLabelText("Delete plan"));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Deleted Morning run",
      variant: "success",
    });
  });

  it("says how soon the next stop is, not only when it is", async () => {
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", 40.5)])],
    });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.getByText("in 40 min")).toBeTruthy();
  });

  it("marks a stop in progress as happening now", async () => {
    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Morning run", -10)])],
    });

    const view = await renderWithProviders(<TodayScreen />);

    expect(view.getByText("Now")).toBeTruthy();
  });

  it("does not re-show the location primer once it was already dismissed", async () => {
    // Regression test: `hasSeenOnboarding` starts `false` (the store's
    // default) and only reflects the real, previously-saved value once the
    // Firestore settings snapshot lands — asynchronously, after this
    // screen's first render. Deciding whether to show the primer before
    // that snapshot arrives used to lock in "show it", so the prompt
    // reappeared on every launch even for users who had already dismissed
    // it. Here `settingsReady` starts false and only flips true once the
    // (already-true) `hasSeenOnboarding` value has "arrived", mirroring the
    // real cloud-hydration race.
    useSettingsStore.setState({ hasSeenOnboarding: false });
    useCloudSyncStore.setState({
      settingsReady: false,
      routinesReady: false,
      slotsReady: false,
    });

    const view = await renderWithProviders(<TodayScreen />);
    expect(view.getByText("Loading your plans…")).toBeTruthy();

    useSettingsStore.setState({ hasSeenOnboarding: true });
    await act(async () => {
      useCloudSyncStore.setState({
        settingsReady: true,
        routinesReady: true,
        slotsReady: true,
      });
    });

    expect(await view.findByText("No plans yet")).toBeTruthy();
    expect(view.queryByText("Know where you are")).toBeNull();
  });

  it("shows the location primer for a first-time user and hides it once dismissed", async () => {
    useSettingsStore.setState({ hasSeenOnboarding: false });

    const view = await renderWithProviders(<TodayScreen />);

    expect(await view.findByText("Know where you are")).toBeTruthy();

    await fireEvent.press(view.getByText("Not now"));
    expect(await view.findByText("Get rain alerts")).toBeTruthy();

    await fireEvent.press(view.getByText("Not now"));
    expect(await view.findByText("No plans yet")).toBeTruthy();
    expect(useSettingsStore.getState().hasSeenOnboarding).toBe(true);
  });

  it("re-renders when a plan is added to the store", async () => {
    // The screen previously subscribed to a store *getter*, whose identity
    // never changes — so it never re-rendered when plans did.
    const view = await renderWithProviders(<TodayScreen />);
    expect(view.getByText("No plans yet")).toBeTruthy();

    useItineraryStore.setState({
      plans: [todaysPlan([slot("s1", "Added later", 45)])],
    });

    expect(await view.findByText("Added later")).toBeTruthy();
  });
});
