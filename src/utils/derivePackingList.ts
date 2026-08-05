const RAIN_KEYWORDS = ["rain", "shower", "thunder", "drizzle"];
const SUN_KEYWORDS = ["fair", "sunny", "warm", "hot"];

export type PackingItem = {
  item: string;
  reason: string;
};

export function derivePackingList(forecastText: string): PackingItem[] {
  const text = forecastText.toLowerCase();
  const items: PackingItem[] = [];

  if (RAIN_KEYWORDS.some((k) => text.includes(k))) {
    items.push({ item: "Umbrella", reason: "Rain expected" });
  }

  if (SUN_KEYWORDS.some((k) => text.includes(k))) {
    items.push(
      { item: "Sunscreen", reason: "Sunny conditions" },
      { item: "Sunglasses", reason: "Sunny conditions" },
    );
  }

  if (text.includes("thunder")) {
    items.push({ item: "Waterproof bag", reason: "Thunderstorms expected" });
  }

  return items;
}
