import { toDateKey, todayKey } from "@/utils/dateKeys";

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
