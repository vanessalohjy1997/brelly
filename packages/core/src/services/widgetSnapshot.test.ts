import type { SlotForecast } from "./weather";
import {
  buildWidgetSnapshot,
  type WidgetForecastEntry,
} from "./widgetSnapshot";
import type { ItinerarySlot } from "../types/itinerary";

const NOW = new Date(2026, 6, 31, 8, 0);

function slot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "s1",
    label: "Picnic",
    location: "East Coast Park, Singapore",
    neaRegion: "east",
    latitude: 1.3009,
    longitude: 103.9124,
    startTime: new Date(2026, 6, 31, 16, 0).toISOString(),
    endTime: new Date(2026, 6, 31, 18, 0).toISOString(),
    ...overrides,
  };
}

function entry(
  slotOverrides: Partial<ItinerarySlot>,
  forecast: SlotForecast,
  forecastText: string | null = forecast.forecast,
): WidgetForecastEntry {
  return { slot: slot(slotOverrides), forecast, forecastText };
}

describe("buildWidgetSnapshot", () => {
  it("returns a null next slot when nothing is upcoming", () => {
    const result = buildWidgetSnapshot([], NOW);

    expect(result.next).toBeNull();
    expect(result.generatedAt).toBe(NOW.toISOString());
  });

  it("drops stops that have already started and keeps the soonest upcoming", () => {
    const past = entry(
      { id: "past", startTime: new Date(2026, 6, 31, 7, 0).toISOString() },
      { forecast: "Fair (Day)", source: "24hr" },
    );
    const soon = entry(
      {
        id: "soon",
        label: "Lunch",
        startTime: new Date(2026, 6, 31, 12, 0).toISOString(),
      },
      { forecast: "Fair (Day)", source: "24hr" },
    );
    const later = entry(
      { id: "later", startTime: new Date(2026, 6, 31, 18, 0).toISOString() },
      { forecast: "Fair (Day)", source: "24hr" },
    );

    // Deliberately unsorted, and with a past stop, to prove the builder does
    // not lean on the caller's ordering or filtering.
    const result = buildWidgetSnapshot([later, past, soon], NOW);

    expect(result.next?.label).toBe("Lunch");
  });

  it("carries a rain verdict at pill length", () => {
    const result = buildWidgetSnapshot(
      [entry({}, { forecast: "Thundery Showers", source: "24hr" })],
      NOW,
    );

    expect(result.next?.umbrella).toEqual({
      needed: true,
      reason: "rain",
      shortLabel: "Rain",
    });
  });

  it("reports a clear stop as clear, not as unknown", () => {
    const result = buildWidgetSnapshot(
      [entry({}, { forecast: "Partly Cloudy", source: "24hr" })],
      NOW,
    );

    expect(result.next?.umbrella).toEqual({
      needed: false,
      reason: "none",
      shortLabel: "Clear",
    });
  });

  it("uses the UV reading for a sun verdict", () => {
    const result = buildWidgetSnapshot(
      [entry({}, { forecast: "Fair (Day)", source: "openMeteoHourly", uvIndex: 10 })],
      NOW,
    );

    expect(result.next?.umbrella?.reason).toBe("sun");
  });

  it("leaves the verdict unknown when no forecast could be loaded", () => {
    const result = buildWidgetSnapshot(
      [entry({}, { forecast: "Couldn't load forecast", source: "error" }, null)],
      NOW,
    );

    expect(result.next?.umbrella).toBeNull();
    expect(result.next?.forecastText).toBeNull();
  });

  it("passes through the temperature range when the tier carries one", () => {
    const result = buildWidgetSnapshot(
      [
        entry(
          {},
          {
            forecast: "Fair (Day)",
            source: "24hr",
            temperature: { low: 26, high: 32 },
          },
        ),
      ],
      NOW,
    );

    expect(result.next?.temperature).toEqual({ low: 26, high: 32 });
  });

  it("omits a temperature the nowcast tier does not report", () => {
    const result = buildWidgetSnapshot(
      [entry({}, { forecast: "Fair (Day)", source: "2hr" })],
      NOW,
    );

    expect(result.next?.temperature).toBeNull();
  });
});
