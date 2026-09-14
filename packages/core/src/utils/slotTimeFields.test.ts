import { toDateKey } from "@/utils/dateKeys";
import {
  applyDayToRange,
  applyEndTime,
  applyStartTime,
  combineDateAndTime,
  endsOnAnotherDay,
} from "@/utils/slotTimeFields";

function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 7, day, hour, minute, 0, 0);
}

describe("combineDateAndTime", () => {
  it("takes the calendar day from one and the time of day from the other", () => {
    const combined = combineDateAndTime(at(5, 0), at(1, 14, 30));

    expect(toDateKey(combined)).toBe("2026-08-05");
    expect(combined.getHours()).toBe(14);
    expect(combined.getMinutes()).toBe(30);
  });

  it("does not mutate either argument", () => {
    const day = at(5, 9);
    combineDateAndTime(day, at(1, 14, 30));
    expect(day.getHours()).toBe(9);
  });
});

describe("applyDayToRange", () => {
  it("moves both ends of the stop, keeping both times of day", () => {
    // The whole point of one date field: moving a plan used to mean editing
    // two datetime pickers, and moving the start backwards left the two halves
    // on different days with nothing saying so.
    const moved = applyDayToRange({ start: at(1, 12), end: at(1, 13, 30) }, at(9, 0));

    expect(toDateKey(moved.start)).toBe("2026-08-09");
    expect(toDateKey(moved.end)).toBe("2026-08-09");
    expect(moved.start.getHours()).toBe(12);
    expect(moved.end.getHours()).toBe(13);
    expect(moved.end.getMinutes()).toBe(30);
  });

  it("keeps a stop that runs past midnight running past midnight", () => {
    const moved = applyDayToRange({ start: at(1, 23), end: at(2, 1) }, at(9, 0));

    expect(toDateKey(moved.start)).toBe("2026-08-09");
    expect(toDateKey(moved.end)).toBe("2026-08-10");
  });

  it("moves backwards as readily as forwards", () => {
    const moved = applyDayToRange({ start: at(9, 12), end: at(9, 13) }, at(1, 0));

    expect(toDateKey(moved.start)).toBe("2026-08-01");
    expect(toDateKey(moved.end)).toBe("2026-08-01");
  });

  it("crosses a month boundary without rolling over", () => {
    const moved = applyDayToRange(
      { start: at(31, 12), end: at(31, 13) },
      new Date(2026, 8, 2),
    );

    expect(toDateKey(moved.start)).toBe("2026-09-02");
  });
});

describe("applyStartTime", () => {
  it("changes the time of day without changing the day", () => {
    const range = applyStartTime({ start: at(1, 12), end: at(1, 15) }, at(1, 9, 45));

    expect(toDateKey(range.start)).toBe("2026-08-01");
    expect(range.start.getHours()).toBe(9);
    expect(range.start.getMinutes()).toBe(45);
  });

  it("leaves a still-valid end alone, so a deliberate duration survives", () => {
    const range = applyStartTime({ start: at(1, 12), end: at(1, 15) }, at(1, 13));

    expect(range.end.getHours()).toBe(15);
  });

  it("pushes an end that the new start has overtaken", () => {
    const range = applyStartTime({ start: at(1, 12), end: at(1, 13) }, at(1, 16));

    expect(range.end.getHours()).toBe(17);
  });

  it("pushes an end the new start exactly meets", () => {
    const range = applyStartTime({ start: at(1, 12), end: at(1, 13) }, at(1, 13));

    expect(range.end.getHours()).toBe(14);
  });
});

describe("applyEndTime", () => {
  it("sets the end on the same day when it is after the start", () => {
    const range = applyEndTime({ start: at(1, 12), end: at(1, 13) }, at(1, 17, 15));

    expect(toDateKey(range.end)).toBe("2026-08-01");
    expect(range.end.getHours()).toBe(17);
    expect(range.end.getMinutes()).toBe(15);
  });

  it("reads an end before the start as running past midnight", () => {
    // The alternative is an error on a picker that only offers times, which
    // the user has no move available to satisfy.
    const range = applyEndTime({ start: at(1, 23), end: at(1, 23, 30) }, at(1, 0, 30));

    expect(toDateKey(range.end)).toBe("2026-08-02");
    expect(range.end.getHours()).toBe(0);
    expect(range.end.getMinutes()).toBe(30);
  });

  it("treats an end equal to the start as the next day, not a zero-length stop", () => {
    const range = applyEndTime({ start: at(1, 12), end: at(1, 13) }, at(1, 12));

    expect(toDateKey(range.end)).toBe("2026-08-02");
  });

  it("never moves the start", () => {
    const range = applyEndTime({ start: at(1, 12), end: at(1, 13) }, at(1, 9));

    expect(range.start).toEqual(at(1, 12));
  });
});

describe("endsOnAnotherDay", () => {
  it("is false for a stop inside one day", () => {
    expect(endsOnAnotherDay({ start: at(1, 12), end: at(1, 13) })).toBe(false);
  });

  it("is true for one that runs past midnight", () => {
    expect(endsOnAnotherDay({ start: at(1, 23), end: at(2, 1) })).toBe(true);
  });
});
