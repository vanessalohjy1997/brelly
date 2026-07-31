export type PsiBand =
  | "good"
  | "moderate"
  | "unhealthy"
  | "very-unhealthy"
  | "hazardous";

export type PsiDescription = {
  band: PsiBand;
  label: string;
  /** Whether this level is worth interrupting someone about. */
  shouldAlert: boolean;
};

// NEA's published PSI bands. Boundaries are inclusive upper bounds: NEA
// describes them as 0–50, 51–100, 101–200, 201–300, above 300.
const BANDS: { max: number; band: PsiBand; label: string }[] = [
  { max: 50, band: "good", label: "Good" },
  { max: 100, band: "moderate", label: "Moderate" },
  { max: 200, band: "unhealthy", label: "Unhealthy" },
  { max: 300, band: "very-unhealthy", label: "Very unhealthy" },
];

const HAZARDOUS: PsiDescription = {
  band: "hazardous",
  label: "Hazardous",
  shouldAlert: true,
};

export function describePsi(psi: number): PsiDescription {
  const match = BANDS.find((b) => psi <= b.max);
  if (!match) return HAZARDOUS;

  return {
    band: match.band,
    label: match.label,
    // "Unhealthy" (101+) is where NEA starts advising people to reduce
    // outdoor activity — below that an alert is noise.
    shouldAlert: psi > 100,
  };
}

/**
 * Whether a haze reading warrants interrupting someone about an outdoor plan.
 * The keyword-matching sibling for rain is `shouldNotifyForRain`; this one is
 * numeric, so it needs no equivalent guard against placeholder strings.
 */
export function shouldNotifyForHaze(psi: number | undefined): boolean {
  if (psi === undefined || Number.isNaN(psi)) return false;
  return describePsi(psi).shouldAlert;
}
