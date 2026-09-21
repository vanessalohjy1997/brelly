import { render, screen, within } from "@testing-library/react";

import { todayKey, shiftDays, type DayPlan } from "@brelly/core";

import { buildWeek, describeCell, WeekStrip } from "./WeekStrip";
import { makePlan, makeSlot } from "@/test/fixtures";

const today = todayKey();

const plans: DayPlan[] = [
  makePlan(today, [makeSlot(), makeSlot({ id: "slot-2" })]),
  makePlan(shiftDays(today, 2), [makeSlot({ id: "slot-3" })]),
];

const addHref = (date: string) => `/plan/new?date=${date}`;
const dayHref = (date: string) => `#day-${date}`;

function strip() {
  return render(<WeekStrip plans={plans} addHref={addHref} dayHref={dayHref} />);
}

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
  it("says a day with stops is one to go to, and spells the count out", () => {
    // The badge is a bare number, which reads as "8, 2" out of context.
    expect(
      describeCell({
        dateKey: today,
        dayLabel: "Today",
        dateLabel: "15",
        planCount: 2,
        isToday: true,
      }),
    ).toBe("Today 15, 2 stops");
    expect(
      describeCell({
        dateKey: today,
        dayLabel: "Wed",
        dateLabel: "17",
        planCount: 1,
        isToday: false,
      }),
    ).toBe("Wed 17, 1 stop");
  });

  it("says an empty day adds a plan, since pressing it does", () => {
    // The cells look like a date picker and are not one. The phone carried
    // this in an `accessibilityHint`, which is the one part of an accessible
    // name a user can switch off.
    expect(
      describeCell({
        dateKey: today,
        dayLabel: "Wed",
        dateLabel: "17",
        planCount: 0,
        isToday: false,
      }),
    ).toBe("Add a plan on Wed 17");
  });
});

describe("WeekStrip", () => {
  it("renders seven links, one per day", () => {
    // Links, not buttons: each cell goes to a real destination with a real URL,
    // so it should be the element that goes to one — and seven ordinary tab
    // stops follow from that rather than a roving-tabindex composite.
    strip();

    const nav = screen.getByRole("navigation", { name: "Week ahead" });
    expect(within(nav).getAllByRole("link")).toHaveLength(7);
  });

  it("sends a day that has stops to its own section on the page", () => {
    // A badged cell looks like "show me that day". Opening the add form there
    // threw away the very stops the badge had just counted.
    strip();

    expect(
      screen.getByRole("link", { name: /^Today \d+, 2 stops$/ }),
    ).toHaveAttribute("href", `#day-${today}`);
  });

  it("sends an empty day to the add form pre-dated to itself", () => {
    strip();
    const tomorrow = shiftDays(today, 1);

    expect(
      screen.getAllByRole("link", { name: /^Add a plan on/ })[0].getAttribute("href"),
    ).toBe(`/plan/new?date=${tomorrow}`);
  });

  it("badges only the days that have stops", () => {
    strip();

    const badged = screen
      .getAllByRole("link")
      .filter((link) => /\d+ stops?$/.test(link.getAttribute("aria-label") ?? ""));
    expect(badged).toHaveLength(2);
  });
});
