import type { DayPlan, ItinerarySlot } from "@/types/itinerary";
import type { Routine } from "@/types/routine";
import { planRoutineMaterialization } from "@/utils/planRoutineMaterialization";
import { routineSlotForDate } from "@/utils/routineOccurrences";

/** 3 Aug 2026 is a Monday; 8 and 9 Aug are that week's Saturday and Sunday. */
const MONDAY = "2026-08-03";
/** Mid-morning on the Monday, so the day's 09:00–18:00 stop is still ahead. */
const NOW = new Date(2026, 7, 3, 10, 0);

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    label: "Office",
    location: "Raffles Place, Singapore",
    latitude: 1.2843,
    longitude: 103.8514,
    weekdays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "18:00",
    startDate: MONDAY,
    exceptions: [],
    ...overrides,
  };
}

/** The slot a routine would have produced, as it would be found in the store. */
function materialized(
  from: Routine,
  date: string,
  overrides: Partial<ItinerarySlot> = {},
): ItinerarySlot {
  return {
    ...routineSlotForDate(from, date),
    id: `slot-${date}`,
    neaRegion: "central",
    ...overrides,
  };
}

function plansOf(...entries: { date: string; slots: ItinerarySlot[] }[]): DayPlan[] {
  return entries.map((entry, index) => ({ id: `p${index}`, ...entry }));
}

const addedDates = (routines: Routine[], plans: DayPlan[], days = 13) =>
  planRoutineMaterialization(routines, plans, NOW, days)
    .filter((action) => action.type === "add")
    .map((action) => action.date);

const removed = (routines: Routine[], plans: DayPlan[], days = 13) =>
  planRoutineMaterialization(routines, plans, NOW, days).filter(
    (action) => action.type === "remove",
  );

describe("planRoutineMaterialization", () => {
  it("fills in every day the routine wants inside the window", () => {
    expect(addedDates([routine()], [], 6)).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
  });

  it("adds nothing a second time", () => {
    const r = routine();
    const plans = plansOf(
      { date: "2026-08-03", slots: [materialized(r, "2026-08-03")] },
      { date: "2026-08-04", slots: [materialized(r, "2026-08-04")] },
    );

    expect(addedDates([r], plans, 6)).toEqual([
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
    expect(removed([r], plans, 6)).toEqual([]);
  });

  it("leaves today alone once the stop has already ended", () => {
    // Half seven in the evening: the 09:00–18:00 stop is over, and minting it
    // now would put a plan straight into the archive.
    const evening = new Date(2026, 7, 3, 19, 30);

    const actions = planRoutineMaterialization([routine()], [], evening, 6);

    expect(actions.filter((a) => a.type === "add").map((a) => a.date)).not.toContain(
      "2026-08-03",
    );
    expect(actions.filter((a) => a.type === "add").map((a) => a.date)).toContain(
      "2026-08-04",
    );
  });

  it("never touches a day before today", () => {
    const r = routine();
    // A stop from last Friday, on a day the routine no longer covers at all.
    const past = materialized(
      routine({ weekdays: [5] }),
      "2026-07-31",
    );
    const plans = plansOf({ date: "2026-07-31", slots: [past] });

    expect(removed([r], plans)).toEqual([]);
  });

  it("sweeps future stops when the routine is deleted", () => {
    const r = routine();
    const plans = plansOf(
      { date: "2026-08-04", slots: [materialized(r, "2026-08-04")] },
      { date: "2026-08-05", slots: [materialized(r, "2026-08-05")] },
    );

    expect(removed([], plans).map((a) => a.date)).toEqual([
      "2026-08-04",
      "2026-08-05",
    ]);
  });

  it("sweeps only the days a deselected weekday covered", () => {
    const r = routine();
    const plans = plansOf(
      { date: "2026-08-04", slots: [materialized(r, "2026-08-04")] }, // Tue
      { date: "2026-08-05", slots: [materialized(r, "2026-08-05")] }, // Wed
    );

    // Tuesday dropped from the rule; Wednesday stays.
    const withoutTuesday = routine({ weekdays: [1, 3, 4, 5] });

    expect(removed([withoutTuesday], plans).map((a) => a.date)).toEqual([
      "2026-08-04",
    ]);
  });

  it("sweeps a day the user made an exception", () => {
    const r = routine();
    const plans = plansOf({
      date: "2026-08-05",
      slots: [materialized(r, "2026-08-05")],
    });
    const withException = routine({ exceptions: ["2026-08-05"] });

    expect(removed([withException], plans).map((a) => a.date)).toEqual([
      "2026-08-05",
    ]);
    expect(addedDates([withException], plans, 3)).not.toContain("2026-08-05");
  });

  it("never sweeps a stop the user detached", () => {
    // "This day only" clears `routineId`; after that the stop is ordinary.
    const detached = materialized(routine(), "2026-08-05", {
      routineId: undefined,
    });
    const plans = plansOf({ date: "2026-08-05", slots: [detached] });

    expect(removed([], plans)).toEqual([]);
    // And the day is not treated as covered, because the exception — not the
    // slot — is what records the detach.
    expect(addedDates([routine({ exceptions: [] })], plans, 3)).toContain(
      "2026-08-05",
    );
  });

  it("replaces a stop that no longer matches its rule", () => {
    const r = routine();
    const stale = materialized(r, "2026-08-05", {
      startTime: new Date(2026, 7, 5, 9, 0).toISOString(),
      label: "Office",
    });
    const plans = plansOf({ date: "2026-08-05", slots: [stale] });
    // The rule now says 10:00, so the 09:00 stop is out of date.
    const retimed = routine({ startTime: "10:00" });

    const actions = planRoutineMaterialization([retimed], plans, NOW, 3).filter(
      (action) => action.date === "2026-08-05",
    );

    // Removed *and* re-added, in that order — a stop still carrying a routine
    // id has not been edited by hand, so the rule is the only authority on it.
    expect(actions).toEqual([
      { type: "remove", date: "2026-08-05", slot: stale },
      {
        type: "add",
        date: "2026-08-05",
        slot: routineSlotForDate(retimed, "2026-08-05"),
      },
    ]);
  });

  it("leaves stops past the horizon alone rather than reading them as unwanted", () => {
    const r = routine();
    // Filled in when the window reached further; it is not "no longer wanted".
    const beyond = materialized(r, "2026-09-01");
    const plans = plansOf({ date: "2026-09-01", slots: [beyond] });

    expect(removed([r], plans, 6)).toEqual([]);
  });

  it("does nothing at all when there are no routines and no routine stops", () => {
    const ordinary: ItinerarySlot = {
      id: "s1",
      label: "Lunch",
      location: "Tiong Bahru",
      neaRegion: "central",
      latitude: 1.2847,
      longitude: 103.8318,
      startTime: new Date(2026, 7, 4, 12, 0).toISOString(),
      endTime: new Date(2026, 7, 4, 13, 0).toISOString(),
    };

    expect(
      planRoutineMaterialization(
        [],
        plansOf({ date: "2026-08-04", slots: [ordinary] }),
        NOW,
        13,
      ),
    ).toEqual([]);
  });
});
