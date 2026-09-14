import { derivePackingList } from "@/utils/derivePackingList";

describe("derivePackingList", () => {
  it("suggests umbrella for rainy forecasts", () => {
    const items = derivePackingList("Afternoon Thundery Showers");
    expect(items.some((i) => i.item === "Umbrella")).toBe(true);
  });

  it("suggests sunscreen and sunglasses for sunny forecasts", () => {
    const items = derivePackingList("Fair and Warm");
    expect(items.some((i) => i.item === "Sunscreen")).toBe(true);
    expect(items.some((i) => i.item === "Sunglasses")).toBe(true);
  });

  it("suggests waterproof bag for thunderstorms", () => {
    const items = derivePackingList("Thundery Showers");
    expect(items.some((i) => i.item === "Waterproof bag")).toBe(true);
  });

  it("suggests both rain and sun items when both apply", () => {
    const items = derivePackingList("Fair and Warm with brief showers");
    expect(items.some((i) => i.item === "Umbrella")).toBe(true);
    expect(items.some((i) => i.item === "Sunscreen")).toBe(true);
  });

  it("returns empty for neutral forecasts", () => {
    expect(derivePackingList("Partly Cloudy")).toEqual([]);
    expect(derivePackingList("Hazy")).toEqual([]);
  });

  it("is case-insensitive", () => {
    const items = derivePackingList("HEAVY RAIN");
    expect(items.some((i) => i.item === "Umbrella")).toBe(true);
  });
});
