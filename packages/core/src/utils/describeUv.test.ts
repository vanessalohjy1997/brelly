import { describeUv, needsUmbrellaForSun } from "@/utils/describeUv";

describe("describeUv", () => {
  it.each([
    [0, "low", "Low"],
    [2, "low", "Low"],
    [3, "moderate", "Moderate"],
    [5, "moderate", "Moderate"],
    [6, "high", "High"],
    [7, "high", "High"],
    [8, "very-high", "Very high"], // a real early-afternoon Singapore reading
    [10, "very-high", "Very high"],
    [11, "extreme", "Extreme"],
    [14, "extreme", "Extreme"],
  ])("puts %i in the %s band", (uv, band, label) => {
    expect(describeUv(uv)).toEqual({ band, label });
  });

  it("carries no alerting decision — sun never notifies", () => {
    expect(describeUv(11)).not.toHaveProperty("shouldAlert");
  });
});

describe("needsUmbrellaForSun", () => {
  it("is false at 'high', which Singapore reaches most clear days", () => {
    expect(needsUmbrellaForSun(7)).toBe(false);
  });

  it("is true from 'very high' upward", () => {
    expect(needsUmbrellaForSun(8)).toBe(true);
    expect(needsUmbrellaForSun(11)).toBe(true);
  });

  it("is false when no reading is available", () => {
    expect(needsUmbrellaForSun(undefined)).toBe(false);
    expect(needsUmbrellaForSun(null)).toBe(false);
  });

  it("is false for a NaN reading rather than throwing", () => {
    expect(needsUmbrellaForSun(Number.NaN)).toBe(false);
  });
});
