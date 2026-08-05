import { StyleSheet, type ViewStyle } from "react-native";

import { WeekStrip } from "@/components/itinerary/WeekStrip";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { shiftDays, todayKey } from "@/utils/dateKeys";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_NOW = new Date(2026, 7, 4, 10, 0, 0); // 2026-08-04 10:00 local

function makeSlot(overrides: Partial<ItinerarySlot> = {}): ItinerarySlot {
  return {
    id: "slot-1",
    label: "Test stop",
    location: "Test location",
    neaRegion: "central",
    latitude: 1.35,
    longitude: 103.82,
    startTime: "10:00",
    endTime: "12:00",
    ...overrides,
  };
}

function makePlan(date: string, slotCount: number): DayPlan {
  return {
    id: `plan-${date}`,
    date,
    slots: Array.from({ length: slotCount }, (_, i) =>
      makeSlot({ id: `slot-${date}-${i}` }),
    ),
  };
}

const borderWidthOf = (element: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(element.props.style as ViewStyle) ?? {}).borderWidth;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FAKE_NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("WeekStrip", () => {
  it("renders exactly 7 day cells", async () => {
    const view = await renderWithProviders(<WeekStrip plans={[]} />);

    // Each cell shows a date number (4, 5, 6, ..., 10 for the week of
    // 2026-08-04). Counting them gives the cell count.
    const today = todayKey();
    for (let i = 0; i < 7; i++) {
      const dateKey = shiftDays(today, i);
      const dayNum = String(Number(dateKey.split("-")[2]));
      expect(view.getByText(dayNum)).toBeTruthy();
    }
  });

  it('labels the first cell "Today" rather than a weekday abbreviation', async () => {
    const view = await renderWithProviders(<WeekStrip plans={[]} />);

    expect(view.getByText("Today")).toBeTruthy();
  });

  it("gives the today cell a distinguishing border", async () => {
    const view = await renderWithProviders(<WeekStrip plans={[]} />);

    // The "Today" text lives inside the cell's View (ThemedView renders a
    // plain View). Walking one level up reaches the cell.
    const todayText = view.getByText("Today");
    const cell = todayText.parent;
    expect(cell).toBeTruthy();
    expect(borderWidthOf(cell!)).toBe(1);
  });

  it("shows the plan count for a day with one stop", async () => {
    const today = todayKey();
    const plans = [makePlan(today, 1)];

    const view = await renderWithProviders(<WeekStrip plans={plans} />);

    expect(view.getByText("1 stop")).toBeTruthy();
  });

  it("pluralises the count for days with multiple stops", async () => {
    const today = todayKey();
    const dayTwo = shiftDays(today, 2);
    const plans = [makePlan(dayTwo, 3)];

    const view = await renderWithProviders(<WeekStrip plans={plans} />);

    expect(view.getByText("3 stops")).toBeTruthy();
  });

  it("does not show a count for days without plans", async () => {
    const view = await renderWithProviders(<WeekStrip plans={[]} />);

    expect(view.queryByText(/stop/)).toBeNull();
  });

  it("shows counts for multiple days at once", async () => {
    const today = todayKey();
    const plans = [
      makePlan(today, 2),
      makePlan(shiftDays(today, 3), 1),
    ];

    const view = await renderWithProviders(<WeekStrip plans={plans} />);

    expect(view.getByText("2 stops")).toBeTruthy();
    expect(view.getByText("1 stop")).toBeTruthy();
  });
});
