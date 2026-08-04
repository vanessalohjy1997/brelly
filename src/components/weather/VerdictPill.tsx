import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themedText";
import { ThemedView } from "@/components/themedView";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { UmbrellaVerdict } from "@/utils/describeUmbrella";

/**
 * 40%, appended as hex alpha to the theme's own umbrella colour.
 *
 * A pill filled with `umbrellaSun` at full strength would need white text at
 * 4.42:1 — under AA — so the tint is washed out instead and the label keeps
 * `text`. 40% is the strongest wash that still does: it leaves the label at
 * 5.45:1 (rain) and 4.99:1 (sun) on the dark theme, and 50% would take sun to
 * 4.03:1.
 *
 * It was 20%, which was too weak to read — the two umbrella colours are
 * deliberately luminance-matched (see `theme.ts`), so *hue* is the only thing
 * separating a rain pill from a sun pill from a clear one, and at 20% only a
 * fifth of that hue was present. Against the dark card the rain pill measured
 * 1.16:1 from the neutral clear pill and 1.04:1 from the sun pill: three
 * different answers rendered as three near-identical violet-grey tags.
 * Doubling the wash takes rain-vs-clear to 1.72:1, and the outline below does
 * the rest.
 */
const WASH = "66";

type Props = {
  verdict: UmbrellaVerdict;
};

/**
 * The verdict as a tag in the corner of a stop card, rather than a sentence
 * in the middle of it. "Umbrella — rain" spelled out competes with the plan's
 * own name for the eye; a pill reads as status, which is what it is, and the
 * umbrella icon beside the forecast already says the "umbrella" half.
 */
export function VerdictPill({ verdict }: Props) {
  const colors = useTheme();

  // Clear stops get the neutral surface, not a third hue — a list where every
  // row is tinted is a list where no tint means anything.
  const background = verdict.themeColor
    ? `${colors[verdict.themeColor]}${WASH}`
    : colors.backgroundSelected;

  // The outline is the same colour at *full* strength, and it is what actually
  // makes the hue legible at this size: a washed fill spreads the colour thin
  // over a 60×20pt tag, while a 1pt line is undiluted. It clears the 3:1
  // graphical threshold on the card it sits on in both themes — 6.01:1 (rain)
  // and 7.19:1 (sun) dark, 4.27:1 and 3.64:1 light — where the fills alone sit
  // under 2:1 of each other.
  //
  // A clear stop takes the neutral `border` instead, so it is quieter than the
  // two that want something from you rather than differently loud. Every pill
  // still has the same shape; only the strength of the hue changes.
  const outline = verdict.themeColor
    ? colors[verdict.themeColor]
    : colors.border;

  return (
    <ThemedView
      style={[
        styles.pill,
        { backgroundColor: background, borderColor: outline },
      ]}
      // The pill is the short form; a screen reader gets the whole sentence,
      // which is no longer written anywhere else on the card. Labelling the
      // pill rather than the text inside it keeps the two from being read as
      // separate stops on the way down the card.
      accessible
      accessibilityRole="text"
      accessibilityLabel={verdict.label}
    >
      <ThemedText style={styles.label} numberOfLines={1}>
        {verdict.shortLabel}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    // A full point, not `hairlineWidth`: this line is carrying a colour, and
    // at 0.33pt on a 3x screen there isn't enough of it to read a hue off.
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
});
