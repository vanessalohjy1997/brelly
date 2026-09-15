/**
 * The mobile app's view of the design tokens.
 *
 * Almost all of them now live in `packages/core/src/constants/theme.ts` and are
 * re-exported below, so both apps are built from one palette and a colour
 * changed on one side only is impossible rather than merely discouraged. Every
 * existing `@/constants/theme` import keeps working unchanged — this file is
 * still the address, it just no longer holds the values.
 *
 * What stays here is what core cannot hold: two `Platform.select` calls and a
 * stylesheet import.
 */

import "@/global.css";

import { Platform } from "react-native";

// Named rather than `export *`, and through the barrel rather than a path into
// core: `@brelly/core` is the package's only entry point, lint-enforced from
// both sides. The list being closed is a small cost with a matching benefit —
// adding a token is a line here, and so is noticing one.
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

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// iOS 26's tab bar floats clear of the bottom edge (the "Liquid Glass" pill,
// not a docked bar), so it takes noticeably more clearance than a standard
// tab bar — 50 measured flush against a real device leaves scrollable
// content's last few points rendering *behind* the pill. 84 (+ Spacing.three
// wherever this is used) clears the pill with the same breathing room every
// other section gets, measured against a screenshot on iOS 26.5.
export const BottomTabInset = Platform.select({ ios: 84, android: 80 }) ?? 0;
