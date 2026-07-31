export type UvBand = "low" | "moderate" | "high" | "very-high" | "extreme";

export type UvDescription = {
  band: UvBand;
  label: string;
  /** Whether this level is worth interrupting someone about. */
  shouldAlert: boolean;
};

// WHO's global UV index bands, which NEA uses: 0–2 low, 3–5 moderate,
// 6–7 high, 8–10 very high, 11+ extreme.
const BANDS: { max: number; band: UvBand; label: string }[] = [
  { max: 2, band: "low", label: "Low" },
  { max: 5, band: "moderate", label: "Moderate" },
  { max: 7, band: "high", label: "High" },
  { max: 10, band: "very-high", label: "Very high" },
];

const EXTREME: UvDescription = {
  band: "extreme",
  label: "Extreme",
  shouldAlert: true,
};

export function describeUv(uvIndex: number): UvDescription {
  const match = BANDS.find((b) => uvIndex <= b.max);
  if (!match) return EXTREME;

  return {
    band: match.band,
    label: match.label,
    // 8+ is where sun protection stops being advisable and starts being
    // necessary. Singapore sits at 8–11 through the middle of most clear
    // days, so alerting from "high" (6) would fire almost daily.
    shouldAlert: uvIndex >= 8,
  };
}

export function shouldNotifyForUv(uvIndex: number | undefined): boolean {
  if (uvIndex === undefined || Number.isNaN(uvIndex)) return false;
  return describeUv(uvIndex).shouldAlert;
}
