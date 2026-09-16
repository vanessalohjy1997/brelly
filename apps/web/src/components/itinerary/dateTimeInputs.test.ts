import {
  fromDateInputValue,
  fromTimeInputValue,
  toDateInputValue,
  toTimeInputValue,
} from "./dateTimeInputs";

describe("toDateInputValue", () => {
  it("formats in local time, not UTC", () => {
    // The trap `toDateKey` exists for in core, in the other direction:
    // `toISOString().slice(0, 10)` would report the previous day for every
    // stop between midnight and 08:00 in Singapore.
    const earlyMorning = new Date(2026, 8, 15, 1, 30);
    expect(toDateInputValue(earlyMorning)).toBe("2026-09-15");
  });

  it("pads the month and day", () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("toTimeInputValue", () => {
  it("formats a 24-hour local clock time", () => {
    expect(toTimeInputValue(new Date(2026, 8, 15, 14, 5))).toBe("14:05");
    expect(toTimeInputValue(new Date(2026, 8, 15, 0, 0))).toBe("00:00");
  });
});

describe("fromDateInputValue", () => {
  it("reads the day as local midnight, not UTC midnight", () => {
    // `new Date("2026-09-15")` is UTC midnight by specification — a date-only
    // string is the one form `Date` treats that way — which is how a day picked
    // in Singapore becomes the day before.
    const parsed = fromDateInputValue("2026-09-15");

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(15);
    expect(parsed?.getHours()).toBe(0);
  });

  it("reports a cleared input as no date rather than as the epoch", () => {
    expect(fromDateInputValue("")).toBeNull();
    expect(fromDateInputValue("not-a-date")).toBeNull();
  });
});

describe("fromTimeInputValue", () => {
  it("applies the time to the day it is given", () => {
    const day = new Date(2026, 8, 15, 9, 30);
    const applied = fromTimeInputValue("14:05", day);

    expect(applied?.getDate()).toBe(15);
    expect(applied?.getHours()).toBe(14);
    expect(applied?.getMinutes()).toBe(5);
    expect(applied?.getSeconds()).toBe(0);
  });

  it("handles midnight, which is falsy in both fields", () => {
    const applied = fromTimeInputValue("00:00", new Date(2026, 8, 15, 9, 30));
    expect(applied?.getHours()).toBe(0);
    expect(applied?.getMinutes()).toBe(0);
  });

  it("reports a cleared input as no time", () => {
    expect(fromTimeInputValue("", new Date())).toBeNull();
  });
});
