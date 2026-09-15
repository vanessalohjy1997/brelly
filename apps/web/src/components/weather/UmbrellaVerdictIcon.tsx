import type { UmbrellaReason } from "@brelly/core";

import { IconSize } from "@/constants/theme";

import { Icons } from "../icons";

/** The two things an umbrella is carried against, drawn around the canopy. */
export type UmbrellaMark = "rain" | "sun";

/**
 * Which marks sit around the umbrella for a given verdict.
 *
 * "both" carries both, in reading order — a stop that trips both triggers needs
 * the umbrella twice over, and saying so with two marks is more honest than
 * picking a winner the way the tint has to.
 *
 * Split out from the component so the mapping can be checked without a
 * renderer, exactly as on the phone.
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

type SizeKey = keyof typeof IconSize;

type Props = {
  /** "none" renders nothing — a clear stop earns no umbrella at all. */
  reason: UmbrellaReason;
  size?: SizeKey;
  /** The verdict tint, from `UmbrellaVerdict.themeColor`, as a Tailwind class. */
  colorClass: string;
  /**
   * The surface the icon sits on, as a Tailwind background class. A mark
   * overlapping the canopy loses its silhouette without a halo of the
   * background behind it, which is most visible at the badge's size.
   */
  haloClass?: string;
  /**
   * Set only where no adjacent text says the same thing. On a stop card the
   * verdict word says it, so it stays decorative there.
   */
  label?: string;
  className?: string;
};

/**
 * The verdict as a picture: an umbrella in the rain, or an umbrella under a sun
 * — the app's whole answer readable before any text is.
 *
 * Neither SF Symbols nor Material Symbols ships a combined glyph, so this
 * composes the umbrella with marks around the canopy. Every part takes the
 * verdict tint, so the icon carries the answer three ways at once — shape,
 * colour and the words beside it — and never by colour alone.
 *
 * This is the one place that draws ligatures itself rather than going through
 * `Icon`. Every size here is a *fraction of the frame* — the fractions the
 * phone's version arrived at and that make the composition read as weather —
 * and `Icon` takes a token key by design, which is what stops arbitrary sizes
 * appearing anywhere else. The frame sets `font-size` from the token and every
 * part is in `em`, so the whole thing scales as one.
 */
export function UmbrellaVerdictIcon({
  reason,
  size = "lead",
  colorClass,
  haloClass,
  label,
  className,
}: Props) {
  const marks = umbrellaMarks(reason);
  if (marks.length === 0) return null;

  const bothMarks = marks.length === 2;
  const drops = bothMarks
    ? RAIN_DROPS_WITH_SUN
    : IconSize[size] < COMPACT_BELOW
      ? RAIN_DROPS_COMPACT
      : RAIN_DROPS;

  // The umbrella keeps the lower three-quarters of the frame; the marks live in
  // the space above it and lap slightly over the canopy, which is what makes
  // them read as weather falling on it rather than as separate icons.
  const umbrellaSize = 0.74;
  const sunSize = 0.32;

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      data-testid={`umbrella-verdict-${reason}`}
      className={["relative block", colorClass, className]
        .filter(Boolean)
        .join(" ")}
      style={{
        fontSize: `var(--brelly-icon-${kebab(size)})`,
        width: "1em",
        height: "1em",
      }}
    >
      {marks.includes("rain") &&
        drops.map((drop) => (
          <Mark
            key={`${drop.left}:${drop.top}`}
            glyph={Icons.humidity}
            scale={drop.scale}
            left={drop.left}
            top={drop.top}
            haloClass={haloClass}
          />
        ))}

      {marks.includes("sun") && (
        <Mark
          glyph={Icons.sunny}
          scale={sunSize}
          // Alone it centres over the canopy; sharing with rain it takes the
          // top-right, which is where the drops leave room.
          left={bothMarks ? 1 - sunSize : (1 - sunSize) / 2}
          top={0}
          haloClass={haloClass}
        />
      )}

      <span
        aria-hidden="true"
        className="material-symbols-rounded absolute bottom-0 leading-none"
        style={{
          fontSize: `${umbrellaSize}em`,
          left: `${(1 - umbrellaSize) / 2}em`,
        }}
      >
        {Icons.umbrella}
      </span>
    </span>
  );
}

/**
 * One mark. Two nested elements rather than one, and not for tidiness: `left`
 * and `top` in `em` resolve against the element's *own* font size, so an
 * element that both positions itself and shrinks itself would measure its
 * offset in its new, smaller em. The outer span keeps the frame's em for the
 * offset; the inner one shrinks.
 */
function Mark({
  glyph,
  scale,
  left,
  top,
  haloClass,
}: {
  glyph: string;
  scale: number;
  left: number;
  top: number;
  haloClass?: string;
}) {
  return (
    <span
      className="absolute"
      style={{ left: `${left}em`, top: `${top}em` }}
    >
      <span
        aria-hidden="true"
        className={["material-symbols-rounded block leading-none", haloClass, haloClass && "rounded-full"]
          .filter(Boolean)
          .join(" ")}
        style={{ fontSize: `${scale}em` }}
      >
        {glyph}
      </span>
    </span>
  );
}

function kebab(size: SizeKey): string {
  return size.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
