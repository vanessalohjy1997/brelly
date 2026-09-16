import { render, screen, within } from "@testing-library/react";

import { todayKey, shiftDays, type DayPlan } from "@brelly/core";

import { buildWeek, describeCell, WeekStrip } from "./WeekStrip";
import { makePlan, makeSlot } from "@/test/fixtures";

const today = todayKey();

const plans: DayPlan[] = [
  makePlan(today, [makeSlot(), makeSlot({ id: "slot-2" })]),
  makePlan(shiftDays(today, 2), [makeSlot({ id: "slot-3" })]),
];

const href = (date: string) => `/plan/new?date=${date}`;

describe("buildWeek", () => {
  it("covers today and the six days after it", () => {
    const cells = buildWeek(plans, today);

    expect(cells).toHaveLength(7);
    expect(cells[0].dateKey).toBe(today);
    expect(cells[6].dateKey).toBe(shiftDays(today, 6));
  });

  it("names the first cell 'Today' rather than by its weekday", () => {
    expect(buildWeek(plans, today)[0]).toMatchObject({
      dayLabel: "Today",
      isToday: true,
    });
  });

  it("counts the stops on each day", () => {
    const cells = buildWeek(plans, today);
    expect(cells[0].planCount).toBe(2);
    expect(cells[1].planCount).toBe(0);
    expect(cells[2].planCount).toBe(1);
  });
});

describe("describeCell", () => {
  it("says what pressing the cell does, not only what day it is", () => {
    // These look like a date picker and are not one: every cell **adds** a
    // plan. The phone carried that in an `accessibilityHint`, which is the one
    // part of an accessible name a user can switch off.
    expect(
      describeCell({
        dateKey: today,
        dayLabel: "Today",
        dateLabel: "15",
        planCount: 2,
        isToday: true,
      }),
    ).toBe("Add a plan on Today 15, 2 stops");
  });

  it("spells the count back out, since the badge is a bare number", () => {
    const base = {
      dateKey: today,
      dayLabel: "Wed",
      dateLabel: "17",
      isToday: false,
    };
    expect(describeCell({ ...base, planCount: 0 })).toContain("no stops");
    expect(describeCell({ ...base, planCount: 1 })).toContain("1 stop");
  });
});

describe("WeekStrip", () => {
  it("renders seven links, one per day", () => {
    // Links, not buttons: each cell goes to a real destination with a real URL,
    // so it should be the element that goes to one — and seven ordinary tab
    // stops follow from that rather than a roving-tabindex composite.
    render(<WeekStrip plans={plans} renderHref={href} />);

    const strip = screen.getByRole("navigation", { name: "Week ahead" });
    expect(within(strip).getAllByRole("link")).toHaveLength(7);
  });

  it("sends each cell to the add form pre-dated to its own day", () => {
    render(<WeekStrip plans={plans} renderHref={href} />);

    expect(
      screen.getByRole("link", { name: /Add a plan on Today/ }),
    ).toHaveAttribute("href", `/plan/new?date=${today}`);
  });

  it("badges only the days that have stops", () => {
    render(<WeekStrip plans={plans} renderHref={href} />);

    const badged = screen
      .getAllByRole("link")
      .filter((link) => /\d+ stops?$/.test(link.getAttribute("aria-label") ?? ""));
    expect(badged).toHaveLength(2);
  });
});
