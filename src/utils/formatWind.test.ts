import { formatWindSpeedKnots } from "@/utils/formatWind";

describe("formatWindSpeedKnots", () => {
  it("converts knots to km/h", () => {
    expect(formatWindSpeedKnots(10)).toBe("19 km/h");
  });

  it("handles a calm reading", () => {
    expect(formatWindSpeedKnots(0)).toBe("0 km/h");
  });

  it("returns null when there's no reading", () => {
    expect(formatWindSpeedKnots(undefined)).toBeNull();
  });
});
