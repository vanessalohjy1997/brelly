import { fireEvent } from "@testing-library/react-native";
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
    const view = await renderWithProviders(
      <WeekStrip plans={[]} onSelectDate={jest.fn()} />,
    );

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
    const view = await renderWithProviders(
      <WeekStrip plans={[]} onSelectDate={jest.fn()} />,
    );

    expect(view.getByText("Today")).toBeTruthy();
  });

  it("gives the today cell a distinguishing border", async () => {
    const view = await renderWithProviders(
      <WeekStrip plans={[]} onSelectDate={jest.fn()} />,
    );

    // The "Today" text lives inside the cell's View (ThemedView renders a
    // plain View). Walking one level up reaches the cell.
    const todayText = view.getByText("Today");
    const cell = todayText.parent;
    expect(cell).toBeTruthy();
    expect(borderWidthOf(cell!)).toBe(1);
  });

  it("shows the plan count as a badge number, not a sentence", async () => {
    const today = todayKey();
    const plans = [makePlan(today, 3)];

    const view = await renderWithProviders(
      <WeekStrip plans={plans} onSelectDate={jest.fn()} />,
    );

    expect(view.getByText("3")).toBeTruthy();
    expect(view.queryByText("3 stops")).toBeNull();
  });

  it("does not render a badge for days without plans", async () => {
    // The week of 2026-08-04 runs 4th–10th, so a "12" on screen can only be a
    // badge — never a date number.
    const empty = await renderWithProviders(
      <WeekStrip plans={[]} onSelectDate={jest.fn()} />,
    );
    expect(empty.queryByText("12")).toBeNull();

    const plans = [makePlan(shiftDays(todayKey(), 1), 12)];
    const filled = await renderWithProviders(
      <WeekStrip plans={plans} onSelectDate={jest.fn()} />,
    );
    expect(filled.getByText("12")).toBeTruthy();
  });

  it("shows badges for multiple days at once", async () => {
    const today = todayKey();
    const plans = [makePlan(today, 2), makePlan(shiftDays(today, 3), 1)];

    const view = await renderWithProviders(
      <WeekStrip plans={plans} onSelectDate={jest.fn()} />,
    );

    // 2 and 1 are not date numbers in the week of 2026-08-04 (4th–10th).
    expect(view.getByText("2")).toBeTruthy();
    expect(view.getByText("1")).toBeTruthy();
  });

  it("spells the count out for screen readers", async () => {
    const today = todayKey();
    const plans = [makePlan(today, 1), makePlan(shiftDays(today, 2), 3)];

    const view = await renderWithProviders(
      <WeekStrip plans={plans} onSelectDate={jest.fn()} />,
    );

    expect(view.getByLabelText("Today 4, 1 stop")).toBeTruthy();
    expect(view.getByLabelText("Thu 6, 3 stops")).toBeTruthy();
  });

  it("says so for a day with no stops", async () => {
    const view = await renderWithProviders(
      <WeekStrip plans={[]} onSelectDate={jest.fn()} />,
    );

    expect(view.getByLabelText("Today 4, no stops")).toBeTruthy();
  });

  it("reports the tapped cell's date key so a new plan can be prefilled", async () => {
    const onSelectDate = jest.fn();
    const view = await renderWithProviders(
      <WeekStrip plans={[]} onSelectDate={onSelectDate} />,
    );
    const today = todayKey();

    await fireEvent.press(view.getByLabelText("Today 4, no stops"));
    expect(onSelectDate).toHaveBeenCalledWith(today);

    await fireEvent.press(view.getByLabelText("Thu 6, no stops"));
    expect(onSelectDate).toHaveBeenCalledWith(shiftDays(today, 2));
  });
});
