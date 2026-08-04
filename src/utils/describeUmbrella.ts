import { needsUmbrellaForSun } from "@/utils/describeUv";
import { shouldNotifyForRain } from "@/utils/shouldNotifyForRain";

export type UmbrellaReason = "rain" | "sun" | "both" | "none";

export type UmbrellaVerdict = {
  reason: UmbrellaReason;
  /** Whether an umbrella is worth carrying at all. */
  needed: boolean;
  /** The full sentence, for screen readers and anywhere with room for it. */
  label: string;
  /**
   * The same answer at pill length. A stop card carries the verdict as a tag
   * in its top corner rather than a sentence in its body, and "Umbrella —
   * rain" does not fit there — but "Rain" beside an umbrella icon says the
   * same thing, because the icon has already said "umbrella".
   */
  shortLabel: string;
  /**
   * Which theme colour carries this verdict, or null when it earns no tint.
   * "Clear" is deliberately colourless — a list where every row is tinted is
   * a list where no tint means anything.
   */
  themeColor: "umbrellaRain" | "umbrellaSun" | null;
};

const CLEAR: UmbrellaVerdict = {
  reason: "none",
  needed: false,
  label: "You're clear",
  shortLabel: "Clear",
  themeColor: null,
};

/**
 * The app's one question, answered: do I need an umbrella for this stop?
 *
 * Two inputs, because in Singapore an umbrella is sun kit as much as rain kit
 * — either trigger firing is enough. Everything else NEA publishes is context
 * rather than the decision.
 *
 * The reason is always carried, not just the yes/no. Singapore sits at UV 8–11
 * through the middle of most clear days, so the bare answer is "yes" often
 * enough to stop being informative — "umbrella — sun" and "umbrella — rain"
 * are different instructions (one is a hat-or-umbrella choice, the other
 * isn't), and that difference is what keeps the line worth reading.
 *
 * Note this is display only. Sun never sends a notification; see the comment
 * on `describeUv`.
 */
export function describeUmbrella(
  forecastText: string | undefined,
  uvIndex: number | null | undefined,
): UmbrellaVerdict {
  const rain = !!forecastText && shouldNotifyForRain(forecastText);
  const sun = needsUmbrellaForSun(uvIndex);

  if (rain && sun) {
    return {
      reason: "both",
      needed: true,
      label: "Umbrella — rain and sun",
      shortLabel: "Rain + sun",
      // Rain wins the tint when both apply: it is the trigger with a cost
      // attached to ignoring it, and a two-tone badge reads as neither.
      themeColor: "umbrellaRain",
    };
  }
  if (rain) {
    return {
      reason: "rain",
      needed: true,
      label: "Umbrella — rain",
      shortLabel: "Rain",
      themeColor: "umbrellaRain",
    };
  }
  if (sun) {
    return {
      reason: "sun",
      needed: true,
      label: "Umbrella — sun",
      shortLabel: "Sun",
      themeColor: "umbrellaSun",
    };
  }
  return CLEAR;
}
