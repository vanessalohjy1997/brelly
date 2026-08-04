import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import NewSlotScreen from "@/app/plan/new";
import { getPlaceDetails, searchPlaces } from "@/services/geocoding";
import { useItineraryStore } from "@/store/itineraryStore";
import { useRoutineStore } from "@/store/routineStore";
import { useToastStore } from "@/store/toastStore";
import { renderWithProviders } from "@/test/renderWithProviders";

jest.mock("@/services/geocoding", () => ({
  searchPlaces: jest.fn(),
  getPlaceDetails: jest.fn(),
}));

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest
    .fn()
    .mockResolvedValue({ forecast: "Cloudy", source: "24hr" }),
}));

const mockSearchPlaces = searchPlaces as jest.Mock;
const mockGetPlaceDetails = getPlaceDetails as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useToastStore.setState({ toast: null, modalHosts: [] });
  mockSearchPlaces.mockResolvedValue([
    { placeId: "p1", displayName: "East Coast Park", secondaryText: "Singapore" },
  ]);
  mockGetPlaceDetails.mockResolvedValue({
    displayName: "East Coast Park, Singapore",
    latitude: 1.3009,
    longitude: 103.9124,
  });
});

/**
 * Fills the form the way a user does: type into Location, wait out the search
 * debounce, pick the suggestion. Picking is what turns typed text into
 * coordinates, and nothing submits without them.
 */
async function pickAPlace(view: Awaited<ReturnType<typeof renderWithProviders>>) {
  await fireEvent.changeText(view.getByLabelText("Location"), "East Coast");

  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  await fireEvent.press(await view.findByText("East Coast Park"));
  await waitFor(() =>
    expect(
      view.getByLabelText("Location set to East Coast Park, Singapore"),
    ).toBeTruthy(),
  );
}

describe("NewSlotScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("adds one plan and dismisses", async () => {
    const view = await renderWithProviders(<NewSlotScreen />);
    await pickAPlace(view);

    await fireEvent.press(view.getByText("Add plan"));

    const plans = useItineraryStore.getState().plans;
    expect(plans).toHaveLength(1);
    expect(plans[0].slots).toHaveLength(1);
    expect(router.back).toHaveBeenCalled();
  });

  it("names the plan after the place, so most stops need no typing", async () => {
    const view = await renderWithProviders(<NewSlotScreen />);
    await pickAPlace(view);

    await fireEvent.press(view.getByText("Add plan"));

    expect(useItineraryStore.getState().plans[0].slots[0].label).toBe(
      "East Coast Park",
    );
  });

  it("keeps a label the user typed when the place is picked afterwards", async () => {
    const view = await renderWithProviders(<NewSlotScreen />);
    await fireEvent.changeText(view.getByLabelText("Label"), "Beach run");
    await pickAPlace(view);

    await fireEvent.press(view.getByText("Add plan"));

    expect(useItineraryStore.getState().plans[0].slots[0].label).toBe(
      "Beach run",
    );
  });

  describe("repeats", () => {
    it("offers a repeat, unlike the edit screen", async () => {
      const view = await renderWithProviders(<NewSlotScreen />);

      expect(view.getByLabelText("Repeat")).toBeTruthy();
    });

    it("stores a rule rather than a fixed run of stops", async () => {
      const view = await renderWithProviders(<NewSlotScreen />);
      await pickAPlace(view);

      await fireEvent.press(view.getByText("Every week"));
      await fireEvent.press(view.getByText("Mon–Fri"));
      await fireEvent.press(view.getByText("Add plan"));

      const [routine] = useRoutineStore.getState().routines;
      expect(routine.label).toBe("East Coast Park");
      expect(routine.weekdays).toEqual([1, 2, 3, 4, 5]);
      // No end date: a routine runs until it's turned off, which is the whole
      // difference from the fixed-count repeat this replaced.
      expect(routine.endDate).toBeUndefined();
    });

    it("fills the days in straight away, so the list isn't empty on the way back", async () => {
      const view = await renderWithProviders(<NewSlotScreen />);
      await pickAPlace(view);

      await fireEvent.press(view.getByText("Every week"));
      await fireEvent.press(view.getByText("Mon–Fri"));
      await fireEvent.press(view.getByText("Add plan"));

      const slots = useItineraryStore
        .getState()
        .plans.flatMap((plan) => plan.slots);
      expect(slots.length).toBeGreaterThan(1);
      // Ordinary stops, each carrying the rule that made them — which is what
      // lets the archive, search and the notification resync ignore routines
      // entirely.
      const [routine] = useRoutineStore.getState().routines;
      expect(slots.every((slot) => slot.routineId === routine.id)).toBe(true);
    });

    it("names the rule in the toast, because a count would be a lie", async () => {
      const view = await renderWithProviders(<NewSlotScreen />);
      await pickAPlace(view);

      await fireEvent.press(view.getByText("Every week"));
      await fireEvent.press(view.getByText("Mon–Fri"));
      await fireEvent.press(view.getByText("Add plan"));

      expect(useToastStore.getState().toast?.message).toBe(
        "Added East Coast Park · Repeats Mon–Fri",
      );
    });

    it("refuses a repeat with no day selected", async () => {
      const view = await renderWithProviders(<NewSlotScreen />);
      await pickAPlace(view);

      await fireEvent.press(view.getByText("Every week"));
      // Clear the day it seeded itself with, leaving the rule meaningless.
      const seeded = view.getAllByRole("checkbox", { checked: true });
      for (const day of seeded) await fireEvent.press(day);
      await fireEvent.press(view.getByText("Add plan"));

      expect(view.getByText("Pick at least one day")).toBeTruthy();
      expect(useRoutineStore.getState().routines).toHaveLength(0);
      expect(router.back).not.toHaveBeenCalled();
    });

    it("defaults to a single stop and no routine", async () => {
      const view = await renderWithProviders(<NewSlotScreen />);
      await pickAPlace(view);

      await fireEvent.press(view.getByText("Add plan"));

      expect(useItineraryStore.getState().plans).toHaveLength(1);
      expect(useRoutineStore.getState().routines).toHaveLength(0);
      expect(useToastStore.getState().toast?.message).toBe(
        "Added East Coast Park",
      );
    });
  });

  it("stays open, keeping what was typed, when nothing was picked", async () => {
    const view = await renderWithProviders(<NewSlotScreen />);
    await fireEvent.changeText(view.getByLabelText("Label"), "Beach run");

    await fireEvent.press(view.getByText("Add plan"));

    expect(useItineraryStore.getState().plans).toHaveLength(0);
    expect(router.back).not.toHaveBeenCalled();
    expect(view.getByDisplayValue("Beach run")).toBeTruthy();
  });
});
