import { parseDateKey, shiftDays, toDateKey, todayKey } from "@/utils/dateKeys";

describe("toDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date(2026, 6, 31, 14, 30))).toBe("2026-07-31");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses the local calendar day, not the UTC one", () => {
    // 00:30 local. In any timezone ahead of UTC, `toISOString()` would still
    // be on the previous calendar day — the bug this function exists to avoid.
    const justAfterMidnight = new Date(2026, 7, 1, 0, 30);
    expect(toDateKey(justAfterMidnight)).toBe("2026-08-01");
  });

  it("keeps the last minute of the day on that day", () => {
    expect(toDateKey(new Date(2026, 7, 1, 23, 59))).toBe("2026-08-01");
  });
});

describe("todayKey", () => {
  it("formats the supplied 'now'", () => {
    expect(todayKey(new Date(2026, 6, 31, 9, 0))).toBe("2026-07-31");
  });

  it("defaults to the current date", () => {
    expect(todayKey()).toBe(toDateKey(new Date()));
  });
});

describe("parseDateKey", () => {
  it("reads a key back as local midnight", () => {
    const date = parseDateKey("2026-08-01");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7); // August
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(0);
  });

  it("round-trips through toDateKey", () => {
    // `new Date("2026-08-01")` parses as UTC midnight, so west of Greenwich it
    // formats back as 31 July. The component form this uses cannot.
    expect(toDateKey(parseDateKey("2026-08-01"))).toBe("2026-08-01");
  });

  it("gives the right weekday, which every routine rule depends on", () => {
    // 3 Aug 2026 is a Monday.
    expect(parseDateKey("2026-08-03").getDay()).toBe(1);
  });
});

describe("shiftDays", () => {
  it("moves forwards and backwards", () => {
    expect(shiftDays("2026-08-03", 1)).toBe("2026-08-04");
    expect(shiftDays("2026-08-03", -1)).toBe("2026-08-02");
    expect(shiftDays("2026-08-03", 0)).toBe("2026-08-03");
  });

  it("rolls over a month end", () => {
    expect(shiftDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("rolls over a year end", () => {
    expect(shiftDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(shiftDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("spans a whole routine horizon in one step", () => {
    expect(shiftDays("2026-08-03", 14)).toBe("2026-08-17");
  });
});
