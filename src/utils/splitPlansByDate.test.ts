import { splitPlansByDate } from "@/utils/splitPlansByDate";
import type { DayPlan } from "@/types/itinerary";

function plan(date: string): DayPlan {
  return { id: date, date, slots: [] };
}

describe("splitPlansByDate", () => {
  it("puts today and future dates in upcoming, sorted soonest first", () => {
    const plans = [plan("2026-08-02"), plan("2026-07-30"), plan("2026-07-31")];
    const { upcoming } = splitPlansByDate(plans, "2026-07-30");

    expect(upcoming.map((p) => p.date)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-02",
    ]);
  });

  it("puts dates before today in past, sorted most recent first", () => {
    const plans = [plan("2026-07-20"), plan("2026-07-29"), plan("2026-07-25")];
    const { past } = splitPlansByDate(plans, "2026-07-30");

    expect(past.map((p) => p.date)).toEqual([
      "2026-07-29",
      "2026-07-25",
      "2026-07-20",
    ]);
  });

  it("returns empty arrays when there are no plans", () => {
    expect(splitPlansByDate([], "2026-07-30")).toEqual({
      upcoming: [],
      past: [],
    });
  });

  it("treats today itself as upcoming, not past", () => {
    const { upcoming, past } = splitPlansByDate([plan("2026-07-30")], "2026-07-30");
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });
});
