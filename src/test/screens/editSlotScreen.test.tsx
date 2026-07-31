import { fireEvent } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";

import EditSlotScreen from "@/app/plan/[id]";
import { useItineraryStore } from "@/store/itineraryStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { DayPlan } from "@/types/itinerary";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest
    .fn()
    .mockResolvedValue({ forecast: "Cloudy", source: "24hr" }),
}));

const mockSearchParams = useLocalSearchParams as unknown as jest.Mock;

const PLAN: DayPlan = {
  id: "p1",
  date: "2026-07-31",
  slots: [
    {
      id: "slot-1",
      label: "Lunch with Sam",
      location: "Tanjong Pagar, Singapore",
      neaRegion: "central",
      latitude: 1.2766,
      longitude: 103.8456,
      startTime: new Date(2026, 6, 31, 12, 30).toISOString(),
      endTime: new Date(2026, 6, 31, 13, 30).toISOString(),
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  useItineraryStore.setState({ plans: [PLAN] });
  mockSearchParams.mockReturnValue({ id: "slot-1" });
});

describe("EditSlotScreen", () => {
  // Regression test. `useItineraryStore((s) => s.findSlotById(id))` returned a
  // fresh `{ date, slot }` object on every render, which zustand's
  // useSyncExternalStore read as a perpetual state change — opening a plan
  // crashed with "Maximum update depth exceeded". The lookup is now a pure
  // function over the (stable) plans array.
  it("renders without re-rendering itself indefinitely", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    expect(view.getByDisplayValue("Lunch with Sam")).toBeTruthy();
  });

  it("prefills the form from the slot being edited", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    expect(view.getByDisplayValue("Lunch with Sam")).toBeTruthy();
    expect(view.getByDisplayValue("Tanjong Pagar, Singapore")).toBeTruthy();
  });

  it("saves changes to the store and navigates back", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.changeText(
      view.getByDisplayValue("Lunch with Sam"),
      "Lunch with Alex",
    );
    await fireEvent.press(view.getByText("Save changes"));

    expect(useItineraryStore.getState().plans[0].slots[0].label).toBe(
      "Lunch with Alex",
    );
    expect(router.back).toHaveBeenCalled();
  });

  it("asks for confirmation before deleting rather than deleting outright", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.press(view.getByText("Delete plan"));

    expect(alertSpy).toHaveBeenCalled();
    expect(useItineraryStore.getState().plans).toHaveLength(1);
    alertSpy.mockRestore();
  });

  it("deletes the slot and navigates back once deletion is confirmed", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        // Press the destructive button the screen offers.
        buttons?.find((b) => b.style === "destructive")?.onPress?.();
      });
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.press(view.getByText("Delete plan"));

    expect(useItineraryStore.getState().plans).toHaveLength(0);
    expect(router.back).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("shows a fallback instead of crashing when the slot no longer exists", async () => {
    mockSearchParams.mockReturnValue({ id: "deleted-slot" });

    const view = await renderWithProviders(<EditSlotScreen />);

    expect(view.getByText("This plan no longer exists.")).toBeTruthy();
  });

  it("does not write to the store until the edit is saved", async () => {
    // The header's Cancel button is a native bar item (see
    // HeaderDismissButton), so it never reaches the rendered tree — what's
    // testable, and what actually matters, is that abandoning the screen
    // can't have already mutated the plan.
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent.changeText(
      view.getByDisplayValue("Lunch with Sam"),
      "Changed but not saved",
    );

    expect(useItineraryStore.getState().plans[0].slots[0].label).toBe(
      "Lunch with Sam",
    );
  });

  it("keeps a per-stop mute through a save", async () => {
    const view = await renderWithProviders(<EditSlotScreen />);

    await fireEvent(
      view.getByLabelText("Rain alerts for this stop"),
      "valueChange",
      false,
    );
    await fireEvent.press(view.getByText("Save changes"));

    expect(useItineraryStore.getState().plans[0].slots[0].notificationsMuted).toBe(
      true,
    );
  });
});
