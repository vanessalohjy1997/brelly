export type UvBand = "low" | "moderate" | "high" | "very-high" | "extreme";

export type UvDescription = {
  band: UvBand;
  label: string;
};

// WHO's global UV index bands, which NEA uses: 0–2 low, 3–5 moderate,
// 6–7 high, 8–10 very high, 11+ extreme.
const BANDS: { max: number; band: UvBand; label: string }[] = [
  { max: 2, band: "low", label: "Low" },
  { max: 5, band: "moderate", label: "Moderate" },
  { max: 7, band: "high", label: "High" },
  { max: 10, band: "very-high", label: "Very high" },
];

const EXTREME: UvDescription = { band: "extreme", label: "Extreme" };

/**
 * There is deliberately no `shouldAlert` here and no `shouldNotifyForUv`.
 * Sun never sends a notification: shade is a preference — a hat, a covered
 * walkway, or nothing are all valid answers — and anyone already outdoors can
 * see it, whereas rain is a necessity that isn't visible from indoors 45
 * minutes ahead. Singapore also sits at UV 8–11 through the middle of most
 * clear days, so a UV trigger would fire almost daily and train people to
 * swipe the app away. UV earns a colour on the card and nothing more.
 */
export function describeUv(uvIndex: number): UvDescription {
  const match = BANDS.find((b) => uvIndex <= b.max);
  if (!match) return EXTREME;

  return { band: match.band, label: match.label };
}

/**
 * Whether UV is high enough that an umbrella is worth carrying for shade.
 * 8 ("very high") is where sun protection stops being advisable and starts
 * being necessary.
 */
export function needsUmbrellaForSun(
  uvIndex: number | null | undefined,
): boolean {
  if (uvIndex === null || uvIndex === undefined || Number.isNaN(uvIndex)) {
    return false;
  }
  return uvIndex >= 8;
}
