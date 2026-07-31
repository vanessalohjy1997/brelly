import { formatWind, formatWindSpeedKnots } from "@/utils/formatWind";

describe("formatWind", () => {
  it("formats a direction and speed range", () => {
    // Shape taken from a live 24hr forecast `general.wind`.
    expect(formatWind({ speed: { low: 10, high: 20 }, direction: "SE" })).toBe(
      "SE 10–20 km/h",
    );
  });

  it("collapses an equal low and high to one figure", () => {
    expect(formatWind({ speed: { low: 15, high: 15 }, direction: "NE" })).toBe(
      "NE 15 km/h",
    );
  });

  it("rounds fractional speeds", () => {
    expect(
      formatWind({ speed: { low: 9.4, high: 20.6 }, direction: "SSE" }),
    ).toBe("SSE 9–21 km/h");
  });

  it("omits the direction when there isn't one", () => {
    expect(formatWind({ speed: { low: 5, high: 10 }, direction: "" })).toBe(
      "5–10 km/h",
    );
  });

  it("returns null when there's no wind data", () => {
    expect(formatWind(undefined)).toBeNull();
  });
});

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
