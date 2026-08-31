import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { getOpenMeteoForecastForSlot } from "@/services/openMeteo";
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
jest.mock("@/services/openMeteo", () => ({
  getOpenMeteoForecastForSlot: jest.fn(),
}));

/**
 * The real `close()` is unobservable here.
 *
 * `swipeableMethods.close` runs through `runOnUI`/`withSpring`, and the
 * Reanimated stand-in makes both identity functions writing into plain
 * objects — so calling it under Jest changes nothing a test can see, and the
 * promise that both actions put the panel away could be deleted from the
 * component without a single assertion noticing. This double hands
 * `renderRightActions` a spy instead, and still renders the row and its
 * actions the way the library does, so every other test in this file is
 * unaffected. The screens keep exercising the real component.
 */
const mockClose = jest.fn();
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  /* eslint-disable @typescript-eslint/no-require-imports --
     a `jest.mock` factory is hoisted above this file's imports, so it cannot
     use them; `require` inside the factory is the only way to reach React from
     here, and it is the pattern `jest.setup.js` already uses for its own
     component stand-ins. */
  const React = require("react");
  const { View } = require("react-native");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    __esModule: true,
    default: ({ children, renderRightActions }: any) =>
      React.createElement(
        View,
        null,
        children,
        renderRightActions?.({ value: 1 }, { value: 0 }, { close: mockClose }),
      ),
  };
});

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

  it("shows the temperature range beside the label, in the relocated weather badge", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(await view.findByText("25–34°C")).toBeTruthy();
  });

  it("shows the reading's age in the top-right corner, beside the plan's time", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(await view.findByText("just now")).toBeTruthy();
  });

  it("shows no age for a past stop — there is no forecast to have one", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} past />,
    );

    expect(view.queryByText("just now")).toBeNull();
  });

  it("lets the location wrap to two lines now that the badge moved beside it", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(view.getByText("Tanjong Pagar, Singapore").props.numberOfLines).toBe(
      2,
    );
  });

  it("answers the umbrella question as a large icon watermark on the card", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    await view.findByLabelText(/^Umbrella — rain\. /);
    expect(view.getByTestId("symbol-umbrella")).toBeTruthy();
    expect(view.getAllByTestId("symbol-water_drop").length).toBeGreaterThan(0);
  });

  it("writes the verdict as a word in the weather column, not only as a watermark", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    // The word answers the umbrella question for a sighted reader — the
    // watermark and accent bar can't carry it alone.
    expect(await view.findByText("Rain")).toBeTruthy();
  });

  it("spells the verdict out for a screen reader, as the full sentence", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(await view.findByLabelText(/^Umbrella — rain\. /)).toBeTruthy();
  });

  it("shows no verdict when there is no forecast to have one about", async () => {
    jest.mocked(getForecastForSlot).mockResolvedValueOnce({
      forecast: "Forecast unavailable",
      source: "unavailable",
    });

    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    // An empty corner, rather than a watermark claiming the stop is clear.
    expect(await view.findByText("No forecast")).toBeTruthy();
    expect(view.queryByLabelText(/Umbrella —/)).toBeNull();
    expect(view.queryByLabelText(/You're clear/)).toBeNull();
    expect(view.queryByTestId("symbol-umbrella")).toBeNull();
  });

  it("shows no watermark on a clear stop — a tinted list is one where no tint means anything", async () => {
    jest.mocked(getForecastForSlot).mockResolvedValueOnce({
      forecast: "Fair (Day)",
      source: "24hr",
      temperature: { low: 26, high: 32 },
      updatedAt: new Date().toISOString(),
    });

    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
    );

    expect(await view.findByLabelText(/^You're clear\. /)).toBeTruthy();
    expect(view.queryByTestId("symbol-umbrella")).toBeNull();
    // Wordless too — no verdict word on a clear stop, only NEA's own wording.
    expect(view.queryByText("Clear")).toBeNull();
    expect(view.getByText("Fair (Day)")).toBeTruthy();
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

  it("shows no verdict for a past stop", async () => {
    const view = await renderWithProviders(
      <ItineraryCard slot={SLOT} onDelete={jest.fn()} past />,
    );

    expect(view.queryByLabelText(/Umbrella —/)).toBeNull();
    expect(view.queryByLabelText(/You're clear/)).toBeNull();
    expect(view.queryByTestId("symbol-umbrella")).toBeNull();
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

  describe("the mute action", () => {
    it("sits beside Delete on the swipe", async () => {
      // Muting used to need the full edit form, so the flag this card already
      // draws as a bell-slash took a modal and a Save to change.
      const view = await renderWithProviders(
        <ItineraryCard
          slot={SLOT}
          onDelete={jest.fn()}
          onToggleMute={jest.fn()}
        />,
      );

      expect(view.getByText("Mute")).toBeTruthy();
      expect(view.getByText("Delete")).toBeTruthy();
    });

    it("calls onToggleMute when pressed, and does not open the stop", async () => {
      const onToggleMute = jest.fn();
      const view = await renderWithProviders(
        <ItineraryCard
          slot={SLOT}
          onDelete={jest.fn()}
          onToggleMute={onToggleMute}
        />,
      );

      await fireEvent.press(view.getByText("Mute"));

      expect(onToggleMute).toHaveBeenCalledTimes(1);
      expect(router.push).not.toHaveBeenCalled();
    });

    it("offers the way back on a stop that is already muted", async () => {
      const view = await renderWithProviders(
        <ItineraryCard
          slot={{ ...SLOT, notificationsMuted: true }}
          onDelete={jest.fn()}
          onToggleMute={jest.fn()}
        />,
      );

      expect(view.getByText("Unmute")).toBeTruthy();
      expect(view.queryByText("Mute")).toBeNull();
      // The accessible name has to open with the word on the button, or
      // "tap Unmute" in Voice Control matches nothing.
      expect(
        view.getByLabelText("Unmute — turn rain alerts on"),
      ).toBeTruthy();
    });

    it("is withheld on an archived card — there is no alert left to mute", async () => {
      const view = await renderWithProviders(
        <ItineraryCard
          slot={SLOT}
          onDelete={jest.fn()}
          onToggleMute={jest.fn()}
          past
        />,
      );

      expect(view.queryByText("Mute")).toBeNull();
      expect(view.getByText("Delete")).toBeTruthy();
    });

    it("is withheld on a list that doesn't offer it", async () => {
      const view = await renderWithProviders(
        <ItineraryCard slot={SLOT} onDelete={jest.fn()} />,
      );

      expect(view.queryByText("Mute")).toBeNull();
    });

    it("puts the panel away, so the row isn't left open over the stop", async () => {
      const view = await renderWithProviders(
        <ItineraryCard
          slot={SLOT}
          onDelete={jest.fn()}
          onToggleMute={jest.fn()}
        />,
      );

      await fireEvent.press(view.getByText("Mute"));

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it("puts the panel away on Delete too, which a cancelled prompt would leave open", async () => {
      // Delete used to get away with leaving it open because the card always
      // went with it. A routine's stop can now raise a day/series prompt and
      // be cancelled, and the next tap on a card with an open panel is
      // swallowed closing the row rather than opening the stop.
      const view = await renderWithProviders(
        <ItineraryCard
          slot={SLOT}
          onDelete={jest.fn()}
          onToggleMute={jest.fn()}
        />,
      );

      await fireEvent.press(view.getByText("Delete"));

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it("is reachable without the swipe, which VoiceOver can't perform", async () => {
      const onToggleMute = jest.fn();
      const view = await renderWithProviders(
        <ItineraryCard
          slot={SLOT}
          onDelete={jest.fn()}
          onToggleMute={onToggleMute}
        />,
      );

      await fireEvent(view.getByText("Lunch with Sam"), "accessibilityAction", {
        nativeEvent: { actionName: "toggle-mute" },
      });

      expect(onToggleMute).toHaveBeenCalledTimes(1);
    });

    it("leaves the delete accessibility action alone", async () => {
      const onDelete = jest.fn();
      const view = await renderWithProviders(
        <ItineraryCard
          slot={SLOT}
          onDelete={onDelete}
          onToggleMute={jest.fn()}
        />,
      );

      await fireEvent(view.getByText("Lunch with Sam"), "accessibilityAction", {
        nativeEvent: { actionName: "delete" },
      });

      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("the repeat mark", () => {
    it("marks a stop a routine filled in", async () => {
      // It is what makes the scope prompt — which a swipe on this card now
      // raises too, not just the edit screen — expected rather than a surprise,
      // and what tells four identical rows down the week from four you
      // happened to type twice.
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

      expect(await view.findByLabelText(/^Umbrella — rain\. /)).toBeTruthy();
      expect(view.getByText("Thundery Showers")).toBeTruthy();
    });
  });

  describe("an overseas (Open-Meteo) slot", () => {
    const OVERSEAS_SLOT: ItinerarySlot = {
      ...SLOT,
      id: "slot-overseas",
      location: "Bangkok",
      provider: "openMeteo",
      latitude: 13.7563,
      longitude: 100.5018,
    };

    it("routes to Open-Meteo, not NEA", async () => {
      jest.mocked(getOpenMeteoForecastForSlot).mockResolvedValueOnce({
        forecast: "Fair (Day)",
        source: "openMeteoHourly",
        temperature: { low: 26, high: 34 },
        uvIndex: 9,
      });

      const view = await renderWithProviders(
        <ItineraryCard slot={OVERSEAS_SLOT} onDelete={jest.fn()} />,
      );

      expect(await view.findByText("Fair (Day)")).toBeTruthy();
      expect(getForecastForSlot).not.toHaveBeenCalled();
    });

    it("takes its UV reading from the inline forecast, not the island-wide useUvIndex value", async () => {
      jest.mocked(getOpenMeteoForecastForSlot).mockResolvedValueOnce({
        forecast: "Fair (Day)",
        source: "openMeteoHourly",
        temperature: { low: 26, high: 34 },
        uvIndex: 9,
      });

      const view = await renderWithProviders(
        <ItineraryCard slot={OVERSEAS_SLOT} onDelete={jest.fn()} />,
      );

      // The real useUvIndex() fetch has nothing to succeed against in this
      // test environment, so a sun verdict here can only have come from
      // the Open-Meteo forecast's own inline uvIndex.
      expect(await view.findByLabelText(/^Umbrella — sun\. /)).toBeTruthy();
      // And it reaches a sighted reader as the word, not only the label.
      expect(view.getByText("Sun")).toBeTruthy();
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
