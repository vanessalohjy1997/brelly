import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import {
  allSlotsWithDates,
  findCurrentOrNextSlot,
  findPlanByDate,
  findSlotById,
  sortSlotsByStart,
  upcomingSlots,
} from "@/utils/planSelectors";

function slot(id: string, startTime: string, endTime = startTime): ItinerarySlot {
  return {
    id,
    label: `Slot ${id}`,
    location: "Somewhere, Singapore",
    neaRegion: "central",
    latitude: 1.3521,
    longitude: 103.8198,
    startTime,
    endTime,
  };
}

const PLANS: DayPlan[] = [
  {
    id: "p1",
    date: "2026-07-31",
    slots: [
      slot("a", "2026-07-31T09:00:00+08:00"),
      slot("b", "2026-07-31T18:00:00+08:00"),
    ],
  },
  { id: "p2", date: "2026-08-01", slots: [slot("c", "2026-08-01T10:00:00+08:00")] },
];

describe("sortSlotsByStart", () => {
  it("puts an earlier stop before a later one", () => {
    const evening = slot("evening", "2026-07-31T18:00:00+08:00");
    const morning = slot("morning", "2026-07-31T09:00:00+08:00");

    expect(sortSlotsByStart([evening, morning])).toEqual([morning, evening]);
  });

  it("undoes a hand-dragged order left behind in storage", () => {
    // Installs that predate the removal of drag-to-reorder still have one
    // persisted, which is why this runs at render and not only on write.
    const nine = slot("a", "2026-07-31T09:00:00+08:00");
    const noon = slot("b", "2026-07-31T12:00:00+08:00");
    const six = slot("c", "2026-07-31T18:00:00+08:00");

    expect(sortSlotsByStart([six, nine, noon])).toEqual([nine, noon, six]);
  });

  it("orders across midnight by instant, not by wall-clock hour", () => {
    const lateNight = slot("late", "2026-07-31T23:30:00+08:00");
    const nextMorning = slot("early", "2026-08-01T07:00:00+08:00");

    expect(sortSlotsByStart([nextMorning, lateNight])).toEqual([
      lateNight,
      nextMorning,
    ]);
  });

  it("leaves the caller's array alone", () => {
    const input = [
      slot("b", "2026-07-31T18:00:00+08:00"),
      slot("a", "2026-07-31T09:00:00+08:00"),
    ];

    sortSlotsByStart(input);

    expect(input.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("handles a day with nothing on it", () => {
    expect(sortSlotsByStart([])).toEqual([]);
  });
});

describe("findSlotById", () => {
  it("returns the slot with the date of the plan containing it", () => {
    expect(findSlotById(PLANS, "c")).toEqual({
      date: "2026-08-01",
      slot: PLANS[1].slots[0],
    });
  });

  it("returns the slot object by reference, not a copy", () => {
    // The screen passes this straight back into `updateSlot`, and referential
    // stability is what lets callers memoize on it.
    expect(findSlotById(PLANS, "a")?.slot).toBe(PLANS[0].slots[0]);
  });

  it("returns undefined for an unknown id", () => {
    expect(findSlotById(PLANS, "nope")).toBeUndefined();
  });

  it("returns undefined when there are no plans", () => {
    expect(findSlotById([], "a")).toBeUndefined();
  });
});

describe("findPlanByDate", () => {
  it("finds the plan for a date", () => {
    expect(findPlanByDate(PLANS, "2026-07-31")).toBe(PLANS[0]);
  });

  it("returns undefined for a date with no plan", () => {
    expect(findPlanByDate(PLANS, "2026-09-09")).toBeUndefined();
  });
});

describe("allSlotsWithDates", () => {
  it("flattens every slot with its plan's date", () => {
    expect(allSlotsWithDates(PLANS).map((f) => [f.date, f.slot.id])).toEqual([
      ["2026-07-31", "a"],
      ["2026-07-31", "b"],
      ["2026-08-01", "c"],
    ]);
  });

  it("returns an empty array for no plans", () => {
    expect(allSlotsWithDates([])).toEqual([]);
  });
});

describe("findCurrentOrNextSlot", () => {
  const morning = slot("morning", "2026-07-31T09:00:00+08:00", "2026-07-31T10:00:00+08:00");
  const afternoon = slot("afternoon", "2026-07-31T14:00:00+08:00", "2026-07-31T16:00:00+08:00");
  const evening = slot("evening", "2026-07-31T19:00:00+08:00", "2026-07-31T21:00:00+08:00");
  const day = [afternoon, morning, evening]; // deliberately unordered

  it("returns the slot currently in progress", () => {
    const result = findCurrentOrNextSlot(day, new Date("2026-07-31T15:00:00+08:00"));
    expect(result?.id).toBe("afternoon");
  });

  it("prefers the in-progress slot over one starting sooner in absolute terms", () => {
    // 09:30 — the morning slot is running, the afternoon one is still ahead.
    const result = findCurrentOrNextSlot(day, new Date("2026-07-31T09:30:00+08:00"));
    expect(result?.id).toBe("morning");
  });

  it("returns the next slot when none is in progress", () => {
    const result = findCurrentOrNextSlot(day, new Date("2026-07-31T12:00:00+08:00"));
    expect(result?.id).toBe("afternoon");
  });

  it("treats a slot's end time as exclusive", () => {
    const result = findCurrentOrNextSlot(day, new Date("2026-07-31T10:00:00+08:00"));
    expect(result?.id).toBe("afternoon");
  });

  it("treats a slot's start time as inclusive", () => {
    const result = findCurrentOrNextSlot(day, new Date("2026-07-31T14:00:00+08:00"));
    expect(result?.id).toBe("afternoon");
  });

  it("falls back to the last slot once the day is over", () => {
    const result = findCurrentOrNextSlot(day, new Date("2026-07-31T23:00:00+08:00"));
    expect(result?.id).toBe("evening");
  });

  it("returns the first slot when the day hasn't started", () => {
    const result = findCurrentOrNextSlot(day, new Date("2026-07-31T06:00:00+08:00"));
    expect(result?.id).toBe("morning");
  });

  it("returns undefined for an empty list", () => {
    expect(findCurrentOrNextSlot([], new Date())).toBeUndefined();
  });
});

describe("upcomingSlots", () => {
  it("keeps only slots starting after now, soonest first", () => {
    const now = new Date("2026-07-31T12:00:00+08:00");
    expect(upcomingSlots(PLANS, now).map((f) => f.slot.id)).toEqual(["b", "c"]);
  });

  it("excludes a slot that has already started", () => {
    const now = new Date("2026-07-31T09:00:01+08:00");
    expect(upcomingSlots(PLANS, now).map((f) => f.slot.id)).not.toContain("a");
  });

  it("returns nothing once every slot is in the past", () => {
    expect(upcomingSlots(PLANS, new Date("2026-09-01T00:00:00+08:00"))).toEqual(
      [],
    );
  });
});
