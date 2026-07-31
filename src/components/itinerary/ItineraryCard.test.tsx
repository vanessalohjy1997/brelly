import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { ItinerarySlot } from "@/types/itinerary";

jest.mock("@/services/weather", () => ({
  getForecastForSlot: jest.fn().mockResolvedValue({
    forecast: "Thundery Showers",
    source: "24hr",
    temperature: { low: 25, high: 34 },
    updatedAt: new Date().toISOString(),
  }),
}));

const SLOT: ItinerarySlot = {
  id: "slot-1",
  label: "Lunch with Sam",
  location: "Tanjong Pagar, Singapore",
  neaRegion: "central",
  latitude: 1.2766,
  longitude: 103.8456,
  startTime: new Date(2026, 6, 31, 12, 30).toISOString(),
  endTime: new Date(2026, 6, 31, 13, 30).toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ItineraryCard", () => {
  it("shows the slot's label, location and time range", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(view.getByText("Lunch with Sam")).toBeTruthy();
    expect(view.getByText("Tanjong Pagar, Singapore")).toBeTruthy();
    expect(view.getByText(/12:30/)).toBeTruthy();
  });

  it("navigates to the slot's edit screen when tapped", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    await fireEvent.press(view.getByText("Lunch with Sam"));

    expect(router.push).toHaveBeenCalledWith("/plan/slot-1");
  });

  it("navigates to the tapped slot, not a fixed one", async () => {
    const other = { ...SLOT, id: "slot-2", label: "Dinner" };
    const view = await renderWithProviders(
      <ItineraryCard slot={other} onDelete={jest.fn()} />,
    );

    await fireEvent.press(view.getByText("Dinner"));

    expect(router.push).toHaveBeenCalledWith("/plan/slot-2");
  });

  it("renders the forecast once it loads", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(await view.findByText("Thundery Showers")).toBeTruthy();
  });

  it("calls onDelete when the swipe action is pressed", async () => {
    const onDelete = jest.fn();
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={onDelete} />,
    );

    await fireEvent.press(view.getByText("Delete"));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when the delete action is pressed", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    await fireEvent.press(view.getByText("Delete"));

    expect(router.push).not.toHaveBeenCalled();
  });
});
