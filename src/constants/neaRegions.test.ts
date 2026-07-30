import { findNearestArea } from "@/constants/neaRegions";
import type { NeaAreaMetadata } from "@/types/weather";

// Real label_location coordinates from data.gov.sg's two-hr-forecast area_metadata.
const AREA_METADATA: NeaAreaMetadata[] = [
  { name: "Ang Mo Kio", latitude: 1.375, longitude: 103.839 },
  { name: "Bedok", latitude: 1.321, longitude: 103.924 },
  { name: "Jurong West", latitude: 1.34039, longitude: 103.705 },
];

describe("findNearestArea", () => {
  it("picks the area whose coordinates are closest, not just the first entry", () => {
    // Just off Bedok's label coordinates, nowhere near the others.
    const result = findNearestArea(1.322, 103.925, AREA_METADATA);
    expect(result).toBe("Bedok");
  });

  it("picks a different area when coordinates are closest to it instead", () => {
    const result = findNearestArea(1.341, 103.706, AREA_METADATA);
    expect(result).toBe("Jurong West");
  });

  it("returns null when there is no area metadata to match against", () => {
    const result = findNearestArea(1.35, 103.8, []);
    expect(result).toBeNull();
  });
});
