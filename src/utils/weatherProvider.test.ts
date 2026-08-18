import {
  deriveWeatherProvider,
  isInSingapore,
  resolveSlotProvider,
} from "@/utils/weatherProvider";

describe("isInSingapore", () => {
  it("is true for the mainland centre", () => {
    expect(isInSingapore(1.3521, 103.8198)).toBe(true);
  });

  it("is true for Tuas, near the western edge", () => {
    expect(isInSingapore(1.3213, 103.6377)).toBe(true);
  });

  it("is true for Changi, near the eastern edge", () => {
    expect(isInSingapore(1.3644, 103.9915)).toBe(true);
  });

  it("is true for Sentosa, a southern island", () => {
    expect(isInSingapore(1.2494, 103.8303)).toBe(true);
  });

  it("is false for Johor Bahru, just across the causeway", () => {
    expect(isInSingapore(1.4927, 103.7414)).toBe(false);
  });

  it("is false for Batam, just south across the strait", () => {
    expect(isInSingapore(1.0456, 104.0305)).toBe(false);
  });

  it("is false for a far country", () => {
    expect(isInSingapore(35.6762, 139.6503)).toBe(false);
  });
});

describe("deriveWeatherProvider", () => {
  it("resolves a Singapore coordinate to nea", () => {
    expect(deriveWeatherProvider(1.3521, 103.8198)).toBe("nea");
  });

  it("resolves an overseas coordinate to openMeteo", () => {
    expect(deriveWeatherProvider(13.7563, 100.5018)).toBe("openMeteo");
  });
});

describe("resolveSlotProvider", () => {
  it("reads a missing provider as nea, matching pre-existing slots", () => {
    expect(resolveSlotProvider(undefined)).toBe("nea");
  });

  it("passes an explicit provider through unchanged", () => {
    expect(resolveSlotProvider("openMeteo")).toBe("openMeteo");
    expect(resolveSlotProvider("nea")).toBe("nea");
  });
});
