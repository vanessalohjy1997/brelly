/**
 * WCAG contrast, for asserting that a difference is actually visible.
 *
 * Every colour in `theme.ts` carries its contrast ratio as a comment, and the
 * ratios there are the reason past regressions were caught. This is the same
 * arithmetic, available to a test: a selection state whose only distinguishing
 * feature is a colour can assert that the colour clears the bar rather than
 * asserting it equals a particular token, which passes just as happily when the
 * token is one the eye cannot separate from its neighbour.
 *
 * The bar is 4.5:1 for text and 3:1 for a graphic — a chip fill is a graphic.
 */

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) =>
    channelLuminance(parseInt(value.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
