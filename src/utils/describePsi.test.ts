import { describePsi, shouldNotifyForHaze } from "@/utils/describePsi";

describe("describePsi", () => {
  it.each([
    [0, "good", "Good"],
    [50, "good", "Good"],
    [51, "moderate", "Moderate"],
    [57, "moderate", "Moderate"], // a real central-region reading
    [100, "moderate", "Moderate"],
    [101, "unhealthy", "Unhealthy"],
    [200, "unhealthy", "Unhealthy"],
    [201, "very-unhealthy", "Very unhealthy"],
    [300, "very-unhealthy", "Very unhealthy"],
    [301, "hazardous", "Hazardous"],
    [471, "hazardous", "Hazardous"], // Singapore's 2013 haze peak
  ])("puts %i in the %s band", (psi, band, label) => {
    expect(describePsi(psi)).toMatchObject({ band, label });
  });

  it("does not alert at or below the moderate ceiling", () => {
    expect(describePsi(100).shouldAlert).toBe(false);
  });

  it("alerts once readings turn unhealthy", () => {
    expect(describePsi(101).shouldAlert).toBe(true);
  });
});

describe("shouldNotifyForHaze", () => {
  it("is false for clear air", () => {
    expect(shouldNotifyForHaze(52)).toBe(false);
  });

  it("is true for unhealthy air", () => {
    expect(shouldNotifyForHaze(150)).toBe(true);
  });

  it("is false when no reading is available", () => {
    expect(shouldNotifyForHaze(undefined)).toBe(false);
  });

  it("is false for a NaN reading rather than throwing", () => {
    expect(shouldNotifyForHaze(Number.NaN)).toBe(false);
  });
});
