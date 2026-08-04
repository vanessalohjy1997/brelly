import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import PlansScreen from "@/app/(tabs)/plans";
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

/**
 * A slot's times have to sit on the day its plan claims: the list is split on
 * each stop's *end time* now, not on the date key, so a fixed calendar date
 * here would file every fixture as past the moment that date went by.
 */
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

/** A stop that ended an hour ago, on today's plan. */
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
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic", 1)])] });
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
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic", 1)])] });
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.getByText("Picnic")).toBeTruthy();
  });

  it("keeps past plans out of the list without deleting them", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch", -2)])],
    });
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.queryByText("Last week's lunch")).toBeNull();
    expect(useItineraryStore.getState().plans).toHaveLength(1);
  });

  it("drops a stop from the list once it has ended, even on today", async () => {
    // The split is per stop, on end time — a 9–11am stop is not "upcoming"
    // for the rest of the day just because its date is today's.
    useItineraryStore.setState({
      plans: [
        dayPlan(0, [
          finishedEarlierToday("done", "Shopping"),
          slot("next", "Dinner", 1),
        ]),
      ],
    });
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.queryByText("Shopping")).toBeNull();
    expect(view.getByText("Dinner")).toBeTruthy();
  });

  it("offers the archive in the header once something has passed", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch", -2)])],
    });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByLabelText("Past plans"));

    expect(router.push).toHaveBeenCalledWith("/past");
  });

  it("shows no archive button when nothing has passed", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic", 1)])] });
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.queryByLabelText("Past plans")).toBeNull();
  });

  it("says nothing is upcoming, not that nothing is planned, when all plans have passed", async () => {
    useItineraryStore.setState({
      plans: [dayPlan(-2, [slot("old", "Last week's lunch", -2)])],
    });
    const view = await renderWithProviders(<PlansScreen />);

    expect(view.getByText("Nothing upcoming")).toBeTruthy();
    expect(view.queryByText("Nothing planned")).toBeNull();
  });

  it("navigates to a plan when its card is tapped", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic", 1)])] });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("Picnic"));

    expect(router.push).toHaveBeenCalledWith("/plan/s1");
  });

  it("removes a slot from the store when its delete action is used", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic", 1)])] });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("Delete"));

    expect(useItineraryStore.getState().plans).toHaveLength(0);
  });

  it("confirms a deleted plan", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic", 1)])] });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("Delete"));

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Deleted Picnic",
      variant: "success",
    });
  });

  it("offers a way back from the swipe delete — the gesture you can trigger by accident", async () => {
    useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic", 1)])] });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("Delete"));
    expect(useItineraryStore.getState().plans).toHaveLength(0);

    useToastStore.getState().toast?.action?.onPress();

    // The day was removed along with its last stop, so the undo has to
    // recreate the plan as well as the slot.
    const plans = useItineraryStore.getState().plans;
    expect(plans).toHaveLength(1);
    expect(plans[0].slots.map((s) => s.id)).toEqual(["s1"]);
  });

  it("clears the cancelled notification's id when restoring, so the slot isn't left looking scheduled", async () => {
    const scheduled = {
      ...slot("s1", "Picnic", 1),
      notificationId: "notif-1",
      notificationLeadMinutes: 45,
    };
    useItineraryStore.setState({ plans: [dayPlan(1, [scheduled])] });
    const view = await renderWithProviders(<PlansScreen />);

    await fireEvent.press(view.getByText("Delete"));
    useToastStore.getState().toast?.action?.onPress();

    const restored = useItineraryStore.getState().plans[0].slots[0];
    expect(restored.notificationId).toBeUndefined();
    expect(restored.notificationLeadMinutes).toBeUndefined();
  });

  it("adds to the day a section header names, rather than making the user scroll a picker to it", async () => {
    useItineraryStore.setState({ plans: [dayPlan(3, [slot("s1", "Picnic", 3)])] });
    const view = await renderWithProviders(<PlansScreen />);

    const date = toDateKey(
      new Date(new Date().setDate(new Date().getDate() + 3)),
    );
    await fireEvent.press(view.getByLabelText(/^Add a plan on /));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/plan/new",
      params: { date },
    });
  });

  describe("search", () => {
    /** Enough stops to be worth searching — see `SearchThreshold`. */
    function manyPlans(): DayPlan[] {
      return [
        dayPlan(1, [
          slot("a", "Lunch with Sam", 1, 12),
          slot("b", "Gym", 1, 18),
          slot("c", "Groceries", 1, 20),
        ]),
        dayPlan(2, [
          slot("d", "Botanic Gardens walk", 2, 9),
          slot("e", "Coffee", 2, 11),
          slot("f", "Dinner", 2, 19),
        ]),
      ];
    }

    it("stays out of the way until the list is long enough to need it", async () => {
      useItineraryStore.setState({ plans: [dayPlan(1, [slot("s1", "Picnic", 1)])] });
      const view = await renderWithProviders(<PlansScreen />);

      expect(view.queryByLabelText("Search plans")).toBeNull();
    });

    it("appears once there are enough stops to scroll past", async () => {
      useItineraryStore.setState({ plans: manyPlans() });
      const view = await renderWithProviders(<PlansScreen />);

      expect(view.getByLabelText("Search plans")).toBeTruthy();
    });

    it("narrows the list to matching stops", async () => {
      useItineraryStore.setState({ plans: manyPlans() });
      const view = await renderWithProviders(<PlansScreen />);

      await fireEvent.changeText(view.getByLabelText("Search plans"), "botanic");

      expect(view.getByText("Botanic Gardens walk")).toBeTruthy();
      expect(view.queryByText("Gym")).toBeNull();
    });

    it("drops a day left with nothing matching", async () => {
      useItineraryStore.setState({ plans: manyPlans() });
      const view = await renderWithProviders(<PlansScreen />);

      await fireEvent.changeText(view.getByLabelText("Search plans"), "gym");

      expect(view.getByText("Gym")).toBeTruthy();
      expect(view.queryByText("Coffee")).toBeNull();
    });

    it("says the query matched nothing rather than that nothing is planned", async () => {
      useItineraryStore.setState({ plans: manyPlans() });
      const view = await renderWithProviders(<PlansScreen />);

      await fireEvent.changeText(view.getByLabelText("Search plans"), "skiing");

      expect(view.getByText("No matches")).toBeTruthy();
      expect(view.queryByText("Nothing planned")).toBeNull();
      expect(view.queryByText("Nothing upcoming")).toBeNull();
    });

    it("keeps the field on screen when the query empties the list", async () => {
      // Otherwise narrowing to nothing removes the control that narrowed it,
      // and there is no way back to the full list but retyping.
      useItineraryStore.setState({ plans: manyPlans() });
      const view = await renderWithProviders(<PlansScreen />);

      await fireEvent.changeText(view.getByLabelText("Search plans"), "skiing");

      expect(view.getByLabelText("Search plans")).toBeTruthy();
    });

    it("restores the whole list from the empty state", async () => {
      useItineraryStore.setState({ plans: manyPlans() });
      const view = await renderWithProviders(<PlansScreen />);

      await fireEvent.changeText(view.getByLabelText("Search plans"), "skiing");
      await fireEvent.press(view.getByText("Clear search"));

      expect(view.getByText("Gym")).toBeTruthy();
      expect(view.getByText("Coffee")).toBeTruthy();
    });
  });

  it("orders a day by start time, not by how it is stored", async () => {
    // The Today tab used to let you drag rows into any order while this list
    // sorted by the clock, so the same day read two different ways.
    useItineraryStore.setState({
      plans: [
        dayPlan(1, [
          slot("s3", "Dinner", 1, 19),
          slot("s1", "Breakfast", 1, 8),
          slot("s2", "Lunch", 1, 12),
        ]),
      ],
    });

    const view = await renderWithProviders(<PlansScreen />);

    expect(
      view
        .getAllByText(/^(Breakfast|Lunch|Dinner)$/)
        .map((node) => node.props.children),
    ).toEqual(["Breakfast", "Lunch", "Dinner"]);
  });
});
