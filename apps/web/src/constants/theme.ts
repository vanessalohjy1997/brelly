/**
 * The web app's view of the design tokens.
 *
 * The values live in `packages/core/src/constants/theme.ts` and are re-exported
 * below, so both apps are built from one palette. Named rather than `export *`,
 * and through the barrel rather than a path into core: `@brelly/core` is the
 * package's only entry point, and the list being closed means adding a token is
 * a line here and so is noticing one.
 *
 * What is added here is `Fonts`, which is a `Platform.select` on the phone and
 * therefore cannot live in core.
 */
export {
  Colors,
  Duration,
  Elevation,
  HeaderHeight,
  HitTarget,
  IconSize,
  MaxContentWidth,
  Opacity,
  Radius,
  Spacing,
  TextStyles,
  ZIndex,
  type TextMetrics,
  type TextVariant,
  type ThemeColor,
} from "@brelly/core";

/**
 * Font stacks, and a deliberate retreat from the ones `global.css` declared.
 *
 * That file asked for `Spline Sans, Inter, …` as `--font-display` and
 * `'SF Pro Rounded'` as `--font-rounded`, and loaded neither: there is no
 * `@font-face` anywhere in the repo and no font file in `assets/`. So on Apple
 * hardware `rounded` resolved and the other two fell through to `system-ui`,
 * and on Windows and Linux all three collapsed onto one face — three names
 * describing one outcome.
 *
 * Rather than load two webfonts to make the distinction real, which is a
 * typography decision this migration has no mandate for and a network cost on
 * every first paint, `sans` and `rounded` are one stack and say so. `SF Pro
 * Rounded` is kept at its head because where it *does* exist it is free.
 */
export const Fonts = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
  rounded:
    "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
} as const;
