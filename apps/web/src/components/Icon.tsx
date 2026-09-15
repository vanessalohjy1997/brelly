import type { IconSize } from "@/constants/theme";

import type { IconName } from "./icons";

/**
 * One icon, as a Material Symbols ligature.
 *
 * `size` is a token *key* rather than a number, and the type is the enforcement
 * — there is no way to pass `20` here, only `"control"`. Read the emphasis note
 * in the theme before choosing between `control`/`controlEmphasis` and
 * `hero`/`heroEmphasis`: the umbrella verdict reads visually lighter than a
 * filled symbol at the same nominal size, so beside one it takes the next step
 * up to match weight.
 *
 * Colour is `currentColor`, always. An icon beside text is part of that text as
 * far as the eye is concerned, so it should take the colour of the thing it
 * belongs to rather than be told one separately.
 */
type Props = {
  name: IconName;
  size?: keyof typeof IconSize;
  /**
   * Set when the icon is the only thing carrying a piece of information — a
   * muted-alerts bell with no words beside it. Left unset the icon is hidden
   * from assistive technology, which is right when adjacent text already says
   * the same thing, and necessary either way: the glyph's *text content* is the
   * ligature, so an unhidden icon is read aloud as "partly_cloudy_day".
   */
  label?: string;
  className?: string;
};

export function Icon({ name, size = "controlEmphasis", label, className }: Props) {
  const glyph = (
    <span
      // `aria-hidden` even when labelled: the label goes on the wrapper, and
      // leaving the ligature exposed would have a screen reader announce both.
      aria-hidden="true"
      data-testid={`icon-${name}`}
      className={[
        "material-symbols-rounded",
        "leading-none select-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        fontSize: `var(--brelly-icon-${kebabIconSize(size)})`,
        width: `var(--brelly-icon-${kebabIconSize(size)})`,
        height: `var(--brelly-icon-${kebabIconSize(size)})`,
      }}
    >
      {name}
    </span>
  );

  if (!label) return glyph;

  return (
    <span role="img" aria-label={label} className="inline-flex">
      {glyph}
    </span>
  );
}

/** `controlEmphasis` → `control-emphasis`, matching the emitted variable. */
function kebabIconSize(size: keyof typeof IconSize): string {
  return size.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
