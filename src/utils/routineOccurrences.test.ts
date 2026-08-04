import type { Routine } from "@/types/routine";
import {
  routineOccurrenceDates,
  routineSlotForDate,
  routineUpdatesFromSlot,
  toTimeOfDay,
} from "@/utils/routineOccurrences";

/**
 * 3 Aug 2026 is a Monday, so 8 Aug is the Saturday of that week and 10 Aug the
 * Monday after. Every date below is anchored to those.
 */
const MONDAY = "2026-08-03";
const SATURDAY = "2026-08-08";

const WEEKDAYS = [1, 2, 3, 4, 5];

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    label: "Office",
    location: "Raffles Place, Singapore",
    latitude: 1.2843,
    longitude: 103.8514,
    weekdays: WEEKDAYS,
    startTime: "09:00",
    endTime: "18:00",
    startDate: MONDAY,
    exceptions: [],
    ...overrides,
  };
}

describe("routineOccurrenceDates", () => {
  it("hits every selected weekday in the window", () => {
    const dates = routineOccurrenceDates(routine(), MONDAY, 6);

    expect(dates).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
  });

  it("skips the weekend, so Mon–Fri means Mon–Fri", () => {
    const dates = routineOccurrenceDates(routine(), MONDAY, 13);

    expect(dates).not.toContain(SATURDAY);
    expect(dates).not.toContain("2026-08-09");
    expect(dates).toContain("2026-08-10");
  });

  it("does not start before the routine does", () => {
    // Window opens on the Monday; the routine only begins on the Wednesday.
    const dates = routineOccurrenceDates(
      routine({ startDate: "2026-08-05" }),
      MONDAY,
      6,
    );

    expect(dates[0]).toBe("2026-08-05");
  });

  it("stops at the end date", () => {
    const dates = routineOccurrenceDates(
      routine({ endDate: "2026-08-05" }),
      MONDAY,
      13,
    );

    expect(dates).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
  });

  it("leaves out days the user deleted", () => {
    const dates = routineOccurrenceDates(
      routine({ exceptions: ["2026-08-05"] }),
      MONDAY,
      6,
    );

    expect(dates).not.toContain("2026-08-05");
    expect(dates).toHaveLength(4);
  });

  it("returns nothing when no day is selected", () => {
    expect(routineOccurrenceDates(routine({ weekdays: [] }), MONDAY, 13)).toEqual(
      [],
    );
  });

  it("crosses a month boundary without arithmetic of its own", () => {
    const dates = routineOccurrenceDates(
      routine({ weekdays: [1], startDate: "2026-08-24" }),
      "2026-08-24",
      14,
    );

    expect(dates).toEqual(["2026-08-24", "2026-08-31", "2026-09-07"]);
  });
});

describe("routineSlotForDate", () => {
  it("puts the routine's times on the given day", () => {
    const slot = routineSlotForDate(routine(), "2026-08-05");

    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7); // August
    expect(start.getDate()).toBe(5);
    expect(start.getHours()).toBe(9);
    expect(end.getDate()).toBe(5);
    expect(end.getHours()).toBe(18);
  });

  it("runs an end at or before the start into the next day", () => {
    const slot = routineSlotForDate(
      routine({ startTime: "23:00", endTime: "00:30" }),
      "2026-08-05",
    );

    const end = new Date(slot.endTime);
    expect(end.getDate()).toBe(6);
    expect(end.getHours()).toBe(0);
    expect(end.getMinutes()).toBe(30);
  });

  it("carries the routine's identity onto the stop", () => {
    const slot = routineSlotForDate(
      routine({ kind: "indoor", notificationsMuted: true }),
      MONDAY,
    );

    expect(slot.routineId).toBe("r1");
    expect(slot.label).toBe("Office");
    expect(slot.location).toBe("Raffles Place, Singapore");
    expect(slot.latitude).toBe(1.2843);
    expect(slot.kind).toBe("indoor");
    expect(slot.notificationsMuted).toBe(true);
  });
});

describe("toTimeOfDay", () => {
  it("pads to HH:MM", () => {
    expect(toTimeOfDay(new Date(2026, 7, 3, 9, 5))).toBe("09:05");
    expect(toTimeOfDay(new Date(2026, 7, 3, 18, 30))).toBe("18:30");
  });
});

describe("routineUpdatesFromSlot", () => {
  it("turns an edited stop back into rule fields", () => {
    const updates = routineUpdatesFromSlot({
      label: "Office (late)",
      location: "Raffles Place, Singapore",
      latitude: 1.2843,
      longitude: 103.8514,
      startTime: new Date(2026, 7, 5, 10, 0).toISOString(),
      endTime: new Date(2026, 7, 5, 19, 0).toISOString(),
      kind: "indoor",
      notificationsMuted: false,
    });

    expect(updates.startTime).toBe("10:00");
    expect(updates.endTime).toBe("19:00");
    expect(updates.label).toBe("Office (late)");
  });

  it("carries no day, because a rule has none", () => {
    const updates = routineUpdatesFromSlot({
      label: "Office",
      location: "Raffles Place, Singapore",
      latitude: 1.2843,
      longitude: 103.8514,
      startTime: new Date(2026, 7, 5, 9, 0).toISOString(),
      endTime: new Date(2026, 7, 5, 18, 0).toISOString(),
      kind: "outdoor",
      notificationsMuted: false,
    });

    expect(updates).not.toHaveProperty("startDate");
    expect(updates).not.toHaveProperty("weekdays");
  });
});
