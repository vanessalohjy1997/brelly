import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { getForecastForSlot } from "@/services/weather";
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

  it("answers the umbrella question as a pill, and as a picture", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(await view.findByText("Rain")).toBeTruthy();
    expect(view.getByTestId("symbol-umbrella")).toBeTruthy();
    expect(view.getAllByTestId("symbol-water_drop").length).toBeGreaterThan(1);
  });

  it("spells the verdict out for a screen reader, short as it looks", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(await view.findByLabelText("Umbrella — rain")).toBeTruthy();
  });

  it("shows no pill when there is no forecast to have a verdict about", async () => {
    jest.mocked(getForecastForSlot).mockResolvedValueOnce({
      forecast: "Forecast unavailable",
      source: "unavailable",
    });

    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    // An empty corner, rather than a pill claiming the stop is clear.
    expect(await view.findByText("No forecast")).toBeTruthy();
    expect(view.queryByText("Clear")).toBeNull();
    expect(view.queryByText("Rain")).toBeNull();
  });

  it("still identifies the stop when it is past", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} past />,
    );

    expect(view.getByText("Lunch with Sam")).toBeTruthy();
    expect(view.getByText("Tanjong Pagar, Singapore")).toBeTruthy();
    expect(view.getByText(/12:30/)).toBeTruthy();
  });

  it("asks for no forecast for a past stop, and shows none", async () => {
    // NEA publishes forecasts, not history, so the request could only come
    // back empty — and an archive would fire one per card to say so.
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} past />,
    );

    expect(view.getByText("Lunch with Sam")).toBeTruthy();
    expect(getForecastForSlot).not.toHaveBeenCalled();
    expect(view.queryByText("Thundery Showers")).toBeNull();
    expect(view.queryByText("No forecast")).toBeNull();
    expect(view.queryByText("Checking the sky…")).toBeNull();
  });

  it("shows no verdict pill for a past stop", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} past />,
    );

    expect(view.queryByText("Rain")).toBeNull();
    expect(view.queryByText("Clear")).toBeNull();
  });

  it("can still be deleted when past", async () => {
    const onDelete = jest.fn();
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={onDelete} past />,
    );

    await fireEvent.press(view.getByText("Delete"));

    expect(onDelete).toHaveBeenCalledTimes(1);
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

  describe("the repeat mark", () => {
    it("marks a stop a routine filled in", async () => {
      // It is what makes the scope prompt on the edit screen expected rather
      // than a surprise, and what tells four identical rows down the week from
      // four you happened to type twice.
      const view = await renderWithProviders(
        <ItineraryCard
          slot={{ ...SLOT, routineId: "r1" }}
          onDelete={jest.fn()}
        />,
      );

      expect(view.getByLabelText("Repeating stop")).toBeTruthy();
    });

    it("leaves a hand-made stop unmarked", async () => {
      const view = await renderWithProviders(
        <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
      );

      expect(view.queryByLabelText("Repeating stop")).toBeNull();
    });
  });

  describe("the indoor tag", () => {
    it("marks a stop that is under a roof", async () => {
      const view = await renderWithProviders(
        <ItineraryCard
          slot={{ ...SLOT, kind: "indoor" }}
          onDelete={jest.fn()}
        />,
      );

      expect(view.getByLabelText("Indoor stop")).toBeTruthy();
    });

    it("leaves an outdoor stop unmarked", async () => {
      // Outdoor is the default and most of the list. A glyph on every row
      // carries no information and costs the label the width.
      const view = await renderWithProviders(
        <ItineraryCard
          slot={{ ...SLOT, kind: "outdoor" }}
          onDelete={jest.fn()}
        />,
      );

      expect(view.queryByLabelText("Indoor stop")).toBeNull();
    });

    it("leaves a stop from before the tag existed unmarked", async () => {
      const view = await renderWithProviders(
        <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
      );

      expect(view.queryByLabelText("Indoor stop")).toBeNull();
    });

    it("still answers the umbrella question for an indoor stop", async () => {
      // Being indoors doesn't get you there. The tag changes which alerts fire,
      // not whether the card says what the weather is doing.
      const view = await renderWithProviders(
        <ItineraryCard
          slot={{ ...SLOT, kind: "indoor" }}
          onDelete={jest.fn()}
        />,
      );

      expect(await view.findByText("Rain")).toBeTruthy();
      expect(view.getByText("Thundery Showers")).toBeTruthy();
    });
  });

  describe("timing", () => {
    /**
     * A slot positioned against the real clock, since the card reads it.
     *
     * The extra 30 seconds are load-bearing: the countdown floors to whole
     * minutes, so a slot exactly 40 minutes out renders as "in 39 min" the
     * moment a millisecond elapses between building the fixture and reading
     * the card. Half a minute of slack puts the assertion in the middle of the
     * bucket instead of on its edge.
     */
    function inMinutes(minutes: number, durationMinutes = 60): ItinerarySlot {
      const start = new Date(Date.now() + minutes * 60 * 1000 + 30 * 1000);
      return {
        ...SLOT,
        startTime: start.toISOString(),
        endTime: new Date(
          start.getTime() + durationMinutes * 60 * 1000,
        ).toISOString(),
      };
    }

    it("leads with how soon a stop is, not just when", async () => {
      const view = await renderWithProviders(
        <ItineraryCard slot={inMinutes(40)} onDelete={jest.fn()} />,
      );

      expect(view.getByText("in 40 min")).toBeTruthy();
    });

    it("keeps the clock times behind the countdown", async () => {
      // A countdown alone says how soon but not which 40 minutes, and the
      // stop still has to be identifiable against a calendar.
      const soon = inMinutes(40);
      const start = new Date(soon.startTime).toLocaleTimeString("en-SG", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const view = await renderWithProviders(
        <ItineraryCard slot={soon} onDelete={jest.fn()} />,
      );

      // The range renders as three text fragments, so this matches the first.
      expect(view.getByText(start, { exact: false })).toBeTruthy();
    });

    it("says a stop in progress is happening now", async () => {
      const view = await renderWithProviders(
        <ItineraryCard slot={inMinutes(-10)} onDelete={jest.fn()} />,
      );

      expect(view.getByText("Now")).toBeTruthy();
    });

    it("says nothing relative about a stop far enough out", async () => {
      const view = await renderWithProviders(
        <ItineraryCard slot={inMinutes(60 * 30)} onDelete={jest.fn()} />,
      );

      expect(view.queryByText(/^in /)).toBeNull();
    });

    it("never counts down on an archived card", async () => {
      // "in 40 min" for something that happened last Tuesday is worse than
      // saying nothing — and `past` cards are all in that position.
      const view = await renderWithProviders(
        <ItineraryCard slot={inMinutes(40)} onDelete={jest.fn()} past />,
      );

      expect(view.queryByText("in 40 min")).toBeNull();
    });
  });
});
