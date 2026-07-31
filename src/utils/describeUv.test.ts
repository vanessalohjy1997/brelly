import { describeUv, shouldNotifyForUv } from "@/utils/describeUv";

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
    expect(describeUv(uv)).toMatchObject({ band, label });
  });

  it("does not alert at 'high', which Singapore reaches most clear days", () => {
    expect(describeUv(7).shouldAlert).toBe(false);
  });

  it("alerts from 'very high' upward", () => {
    expect(describeUv(8).shouldAlert).toBe(true);
  });
});

describe("shouldNotifyForUv", () => {
  it("is false for a low index", () => {
    expect(shouldNotifyForUv(1)).toBe(false);
  });

  it("is true for an extreme index", () => {
    expect(shouldNotifyForUv(11)).toBe(true);
  });

  it("is false when no reading is available", () => {
    expect(shouldNotifyForUv(undefined)).toBe(false);
  });

  it("is false for a NaN reading rather than throwing", () => {
    expect(shouldNotifyForUv(Number.NaN)).toBe(false);
  });
});
