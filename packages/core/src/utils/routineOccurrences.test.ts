import type { Routine } from "../types/routine";
import {
  materializedSlotId,
  routineOccurrenceDates,
  routineSlotForDate,
  routineUpdatesFromSlot,
  toTimeOfDay,
} from "./routineOccurrences";

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

  describe("monthly", () => {
    function monthlyRoutine(overrides: Partial<Routine> = {}): Routine {
      return routine({
        frequency: "monthly",
        weekdays: [],
        dayOfMonth: 15,
        ...overrides,
      });
    }

    it("hits the day of the month once inside the window", () => {
      const dates = routineOccurrenceDates(monthlyRoutine(), "2026-08-10", 13);

      expect(dates).toEqual(["2026-08-15"]);
    });

    it("skips a month that has no such day — the 31st in February", () => {
      // Scanning all of February 2026 (28 days) for a 31st finds nothing, which
      // is the standard RRULE behaviour and needs no special case here.
      const dates = routineOccurrenceDates(
        monthlyRoutine({ dayOfMonth: 31, startDate: "2026-02-01" }),
        "2026-02-01",
        27,
      );

      expect(dates).toEqual([]);
    });

    it("lands on 29 February in a leap year", () => {
      // 2028 is a leap year, so the 29th exists that February.
      const dates = routineOccurrenceDates(
        monthlyRoutine({ dayOfMonth: 29, startDate: "2028-02-01" }),
        "2028-02-01",
        28,
      );

      expect(dates).toEqual(["2028-02-29"]);
    });

    it("respects the routine's start and end dates", () => {
      const dates = routineOccurrenceDates(
        monthlyRoutine({
          dayOfMonth: 15,
          startDate: "2026-09-16", // after September's 15th
          endDate: "2026-11-14", // before November's 15th
        }),
        "2026-08-01",
        120,
      );

      // Only October's 15th falls inside [start, end].
      expect(dates).toEqual(["2026-10-15"]);
    });

    it("leaves out a monthly day the user deleted", () => {
      const dates = routineOccurrenceDates(
        monthlyRoutine({ exceptions: ["2026-08-15"] }),
        "2026-08-01",
        45,
      );

      expect(dates).not.toContain("2026-08-15");
      expect(dates).toContain("2026-09-15");
    });
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
      routine({ kind: "indoor", notificationsMuted: true, countryCode: "SG" }),
      MONDAY,
    );

    expect(slot.routineId).toBe("r1");
    expect(slot.label).toBe("Office");
    expect(slot.location).toBe("Raffles Place, Singapore");
    expect(slot.latitude).toBe(1.2843);
    expect(slot.kind).toBe("indoor");
    expect(slot.notificationsMuted).toBe(true);
    // Without this a routine's stops would be the only ones with no country,
    // and the gap warning would treat every leg to one as unknown.
    expect(slot.countryCode).toBe("SG");
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
      countryCode: "JP",
      startTime: new Date(2026, 7, 5, 10, 0).toISOString(),
      endTime: new Date(2026, 7, 5, 19, 0).toISOString(),
      kind: "indoor",
      notificationsMuted: false,
    });

    expect(updates.startTime).toBe("10:00");
    expect(updates.endTime).toBe("19:00");
    expect(updates.label).toBe("Office (late)");
    // Moving the rule's location abroad has to move its country with it, or
    // every stop it fills in afterwards names the old one.
    expect(updates.countryCode).toBe("JP");
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

describe("materializedSlotId", () => {
  it("is deterministic for the same routine and date", () => {
    expect(materializedSlotId("r1", "2026-08-03")).toBe(
      materializedSlotId("r1", "2026-08-03"),
    );
  });

  it("differs across routines and across dates", () => {
    expect(materializedSlotId("r1", "2026-08-03")).not.toBe(
      materializedSlotId("r2", "2026-08-03"),
    );
    expect(materializedSlotId("r1", "2026-08-03")).not.toBe(
      materializedSlotId("r1", "2026-08-04"),
    );
  });
});
