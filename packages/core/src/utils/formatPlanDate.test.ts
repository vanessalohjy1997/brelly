import { formatPlanDate } from "@/utils/formatPlanDate";

const TODAY = "2026-08-01";

describe("formatPlanDate", () => {
  it("names today, tomorrow and yesterday", () => {
    expect(formatPlanDate("2026-08-01", TODAY)).toBe("Today");
    expect(formatPlanDate("2026-08-02", TODAY)).toBe("Tomorrow");
    expect(formatPlanDate("2026-07-31", TODAY)).toBe("Yesterday");
  });

  it("spells out any other day", () => {
    expect(formatPlanDate("2026-08-05", TODAY)).toBe("Wednesday, 5 August");
  });

  it("crosses a month boundary in both directions", () => {
    // 1 August's neighbours are in July, and 31 August's are in September —
    // the arithmetic has to be real date arithmetic, not string surgery.
    expect(formatPlanDate("2026-07-31", "2026-08-01")).toBe("Yesterday");
    expect(formatPlanDate("2026-09-01", "2026-08-31")).toBe("Tomorrow");
  });

  it("crosses a year boundary", () => {
    expect(formatPlanDate("2025-12-31", "2026-01-01")).toBe("Yesterday");
  });

  it("reads a date key in the local timezone, not UTC", () => {
    // `new Date("2026-08-05")` is UTC midnight, which formats as 4 August in
    // any timezone behind Greenwich. The weekday has to match the key.
    expect(formatPlanDate("2026-08-05", TODAY)).toContain("5 August");
  });
});
