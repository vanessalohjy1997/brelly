import { StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import type { UmbrellaReason } from "@/utils/describeUmbrella";

const UMBRELLA: IconName = { ios: "umbrella.fill", android: "umbrella" };
const RAIN_MARK: IconName = { ios: "drop.fill", android: "water_drop" };
const SUN_MARK: IconName = { ios: "sun.max.fill", android: "sunny" };

/** The two things an umbrella is carried against, drawn around the canopy. */
export type UmbrellaMark = "rain" | "sun";

const MARK_ICONS: Record<UmbrellaMark, IconName> = {
  rain: RAIN_MARK,
  sun: SUN_MARK,
};

/**
 * Which marks sit around the umbrella for a given verdict.
 *
 * "both" carries both, in reading order — a stop that trips both triggers
 * needs the umbrella twice over, and saying so with two marks is more honest
 * than picking a winner the way the tint has to.
 *
 * Split out from the component so the mapping can be checked without a
 * renderer, and so a caller can size a row of them without guessing.
 */
export function umbrellaMarks(reason: UmbrellaReason): UmbrellaMark[] {
  if (reason === "both") return ["rain", "sun"];
  if (reason === "rain") return ["rain"];
  if (reason === "sun") return ["sun"];
  return [];
}

/** Where one drop sits and how big it is, as fractions of the frame. */
type Drop = { left: number; top: number; scale: number };

/**
 * A scatter of small drops above and beside the canopy.
 *
 * The icon used to carry a single drop at 0.36 of the frame, which read as a
 * second icon parked on top of the umbrella rather than as weather. Several
 * small ones — some overhead, some falling past the edges — read as rain.
 */
const RAIN_DROPS: Drop[] = [
  { left: 0.39, top: -0.02, scale: 0.2 },
  { left: 0.13, top: 0.08, scale: 0.16 },
  { left: 0.68, top: 0.07, scale: 0.16 },
  { left: -0.01, top: 0.4, scale: 0.13 },
  { left: 0.87, top: 0.38, scale: 0.13 },
];

/** With the sun holding the top-right, the drops keep the left and the flank. */
const RAIN_DROPS_WITH_SUN: Drop[] = [
  { left: 0.1, top: 0.01, scale: 0.18 },
  { left: 0.34, top: 0.14, scale: 0.13 },
  { left: -0.01, top: 0.4, scale: 0.13 },
];

/**
 * Fewer, bigger drops for the small sizes the app uses in list rows. The full
 * scatter at 22px puts 3px drops on screen, which is dust rather than rain.
 */
const RAIN_DROPS_COMPACT: Drop[] = [
  { left: 0.36, top: -0.02, scale: 0.26 },
  { left: 0.05, top: 0.1, scale: 0.19 },
  { left: 0.75, top: 0.09, scale: 0.19 },
];

/** Below this the frame has no room for the full scatter. */
const COMPACT_BELOW = 30;

type Props = {
  /** "none" renders nothing — a clear stop earns no umbrella at all. */
  reason: UmbrellaReason;
  size?: number;
  /** The verdict tint, from `UmbrellaVerdict.themeColor`. */
  color: string;
  /**
   * The surface the icon sits on. A mark overlapping the canopy loses its
   * silhouette without a halo of the background behind it, which is most
   * visible at the badge's size.
   */
  haloColor?: string;
  /**
   * Set only where no adjacent text says the same thing. On a stop card the
   * verdict pill says it, so it stays decorative there.
   */
  accessibilityLabel?: string;
};

/**
 * The verdict as a picture: an umbrella in the rain, or an umbrella under a
 * sun — the app's whole answer readable before any text is.
 *
 * Neither SF Symbols nor Material Symbols ships a combined glyph, so this
 * composes the umbrella with marks around the canopy. Every part takes the
 * verdict tint, so the icon carries the answer three ways at once — shape,
 * colour and the adjacent pill — and never by colour alone.
 */
export function UmbrellaVerdictIcon({
  reason,
  size = 40,
  color,
  haloColor,
  accessibilityLabel,
}: Props) {
  const marks = umbrellaMarks(reason);
  if (marks.length === 0) return null;

  // The umbrella keeps the lower three-quarters of the frame; the marks live
  // in the space above it and lap slightly over the canopy, which is what
  // makes them read as weather falling on it rather than as separate icons.
  const umbrellaSize = size * 0.74;
  const sunSize = size * 0.32;
  const bothMarks = marks.length === 2;
  const drops = bothMarks
    ? RAIN_DROPS_WITH_SUN
    : size < COMPACT_BELOW
      ? RAIN_DROPS_COMPACT
      : RAIN_DROPS;

  const halo = (markSize: number) =>
    haloColor ? { backgroundColor: haloColor, borderRadius: markSize } : null;

  return (
    <View
      style={[styles.frame, { width: size, height: size }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "image" : "none"}
    >
      {marks.includes("rain") &&
        drops.map((drop) => {
          const markSize = size * drop.scale;
          return (
            <View
              key={`${drop.left}:${drop.top}`}
              style={[
                styles.mark,
                { left: size * drop.left, top: size * drop.top },
                halo(markSize),
              ]}
            >
              <Icon name={MARK_ICONS.rain} size={markSize} tintColor={color} />
            </View>
          );
        })}

      {marks.includes("sun") && (
        <View
          style={[
            styles.mark,
            // Alone it centres over the canopy; sharing with rain it takes the
            // top-right, which is where the drops leave room.
            bothMarks
              ? { right: 0, top: 0 }
              : { left: (size - sunSize) / 2 - 1, top: 0 },
            halo(sunSize),
          ]}
        >
          <Icon name={MARK_ICONS.sun} size={sunSize} tintColor={color} />
        </View>
      )}

      <Icon
        name={UMBRELLA}
        size={umbrellaSize}
        tintColor={color}
        style={[styles.umbrella, { left: (size - umbrellaSize) / 2 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    backgroundColor: "transparent",
  },
  umbrella: {
    position: "absolute",
    bottom: 0,
  },
  mark: {
    position: "absolute",
    padding: 1,
  },
});
