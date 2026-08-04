import { formatLeadTime, formatLeadTimeShort } from "@/utils/formatLeadTime";
import { RAIN_LEAD_MINUTES } from "@/store/settingsStore";

describe("formatLeadTime", () => {
  it.each([
    [15, "15 minutes"],
    [30, "30 minutes"],
    [45, "45 minutes"],
    [60, "1 hour"],
  ])("formats %i as %s", (minutes, expected) => {
    expect(formatLeadTime(minutes)).toBe(expected);
  });

  it("pluralises past one hour", () => {
    expect(formatLeadTime(120)).toBe("2 hours");
  });

  it("covers every offered choice", () => {
    for (const minutes of RAIN_LEAD_MINUTES) {
      expect(formatLeadTime(minutes)).not.toContain("undefined");
    }
  });
});

describe("formatLeadTimeShort", () => {
  it.each([
    [15, "15 min"],
    [30, "30 min"],
    [45, "45 min"],
    [60, "1 hr"],
  ])("formats %i as %s", (minutes, expected) => {
    expect(formatLeadTimeShort(minutes)).toBe(expected);
  });
});
