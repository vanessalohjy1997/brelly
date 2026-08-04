import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import { splitPlansByTime } from "@/utils/splitPlansByTime";

const NOW = new Date(2026, 7, 1, 14, 0); // 1 Aug 2026, 2pm local

function slot(id: string, start: Date, end: Date): ItinerarySlot {
  return {
    id,
    label: id,
    location: "East Coast Park, Singapore",
    neaRegion: "east",
    latitude: 1.3009,
    longitude: 103.9124,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function at(day: number, hour: number): Date {
  return new Date(2026, 7, day, hour, 0);
}

function plan(date: string, slots: ItinerarySlot[]): DayPlan {
  return { id: date, date, slots };
}

describe("splitPlansByTime", () => {
  it("returns empty buckets when there are no plans", () => {
    expect(splitPlansByTime([], NOW)).toEqual({ upcoming: [], past: [] });
  });

  it("files a whole earlier day as past", () => {
    const plans = [plan("2026-07-30", [slot("lunch", at(-1, 12), at(-1, 13))])];

    const { upcoming, past } = splitPlansByTime(plans, NOW);

    expect(upcoming).toEqual([]);
    expect(past.map((p) => p.date)).toEqual(["2026-07-30"]);
  });

  it("files a whole later day as upcoming", () => {
    const plans = [plan("2026-08-03", [slot("picnic", at(3, 12), at(3, 13))])];

    const { upcoming, past } = splitPlansByTime(plans, NOW);

    expect(upcoming.map((p) => p.date)).toEqual(["2026-08-03"]);
    expect(past).toEqual([]);
  });

  it("splits today across both buckets on end time, not on the date", () => {
    // The whole point of replacing the date-only split: a 9–11am stop is
    // history at 2pm even though its day is still "today".
    const plans = [
      plan("2026-08-01", [
        slot("shopping", at(1, 9), at(1, 11)),
        slot("dinner", at(1, 19), at(1, 21)),
      ]),
    ];

    const { upcoming, past } = splitPlansByTime(plans, NOW);

    expect(upcoming[0].slots.map((s) => s.id)).toEqual(["dinner"]);
    expect(past[0].slots.map((s) => s.id)).toEqual(["shopping"]);
    expect(upcoming[0].date).toBe("2026-08-01");
    expect(past[0].date).toBe("2026-08-01");
  });

  it("counts a stop as upcoming until the minute it ends", () => {
    const plans = [
      plan("2026-08-01", [slot("meeting", at(1, 13), new Date(2026, 7, 1, 14, 1))]),
    ];

    const { upcoming, past } = splitPlansByTime(plans, NOW);

    expect(upcoming[0].slots.map((s) => s.id)).toEqual(["meeting"]);
    expect(past).toEqual([]);
  });

  it("counts a stop that ends exactly now as past", () => {
    const plans = [plan("2026-08-01", [slot("meeting", at(1, 13), at(1, 14))])];

    const { upcoming, past } = splitPlansByTime(plans, NOW);

    expect(upcoming).toEqual([]);
    expect(past[0].slots.map((s) => s.id)).toEqual(["meeting"]);
  });

  it("drops a day from the bucket it has nothing in", () => {
    const plans = [
      plan("2026-08-01", [slot("shopping", at(1, 9), at(1, 11))]),
      plan("2026-08-03", [slot("picnic", at(3, 12), at(3, 13))]),
    ];

    const { upcoming, past } = splitPlansByTime(plans, NOW);

    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(1);
  });

  it("orders upcoming days soonest first and past days most recent first", () => {
    const plans = [
      plan("2026-08-05", [slot("a", at(5, 12), at(5, 13))]),
      plan("2026-07-25", [slot("b", at(-6, 12), at(-6, 13))]),
      plan("2026-08-02", [slot("c", at(2, 12), at(2, 13))]),
      plan("2026-07-30", [slot("d", at(-1, 12), at(-1, 13))]),
    ];

    const { upcoming, past } = splitPlansByTime(plans, NOW);

    expect(upcoming.map((p) => p.date)).toEqual(["2026-08-02", "2026-08-05"]);
    expect(past.map((p) => p.date)).toEqual(["2026-07-30", "2026-07-25"]);
  });

  it("keeps each day's stops in start-time order in both buckets", () => {
    const plans = [
      plan("2026-08-01", [
        slot("late-morning", at(1, 10), at(1, 11)),
        slot("dinner", at(1, 19), at(1, 21)),
        slot("breakfast", at(1, 7), at(1, 8)),
        slot("supper", at(1, 22), at(1, 23)),
      ]),
    ];

    const { upcoming, past } = splitPlansByTime(plans, NOW);

    expect(past[0].slots.map((s) => s.id)).toEqual(["breakfast", "late-morning"]);
    expect(upcoming[0].slots.map((s) => s.id)).toEqual(["dinner", "supper"]);
  });

  it("does not mutate the plans it is given", () => {
    const original = plan("2026-08-01", [
      slot("dinner", at(1, 19), at(1, 21)),
      slot("shopping", at(1, 9), at(1, 11)),
    ]);

    splitPlansByTime([original], NOW);

    expect(original.slots.map((s) => s.id)).toEqual(["dinner", "shopping"]);
  });

  it("files a slot with an unreadable end time as past rather than losing it", () => {
    const broken = { ...slot("odd", at(1, 9), at(1, 11)), endTime: "not a date" };

    const { upcoming, past } = splitPlansByTime(
      [plan("2026-08-01", [broken])],
      NOW,
    );

    expect(upcoming).toEqual([]);
    expect(past[0].slots.map((s) => s.id)).toEqual(["odd"]);
  });
});
