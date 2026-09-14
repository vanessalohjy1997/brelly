import { formatPeriodLabel } from "@/utils/formatPeriodLabel";

describe("formatPeriodLabel", () => {
  it("labels 6am–11:59am as Morning", () => {
    expect(formatPeriodLabel(new Date(2026, 0, 1, 6, 0))).toBe("Morning");
    expect(formatPeriodLabel(new Date(2026, 0, 1, 11, 59))).toBe("Morning");
  });

  it("labels 12pm–5:59pm as Afternoon", () => {
    expect(formatPeriodLabel(new Date(2026, 0, 1, 12, 0))).toBe("Afternoon");
    expect(formatPeriodLabel(new Date(2026, 0, 1, 17, 59))).toBe("Afternoon");
  });

  it("labels 6pm–5:59am as Night", () => {
    expect(formatPeriodLabel(new Date(2026, 0, 1, 18, 0))).toBe("Night");
    expect(formatPeriodLabel(new Date(2026, 0, 1, 2, 0))).toBe("Night");
  });

  it("accepts an ISO string as well as a Date", () => {
    const isoMorning = new Date(2026, 0, 1, 8, 0).toISOString();
    expect(formatPeriodLabel(isoMorning)).toBe("Morning");
  });
});
