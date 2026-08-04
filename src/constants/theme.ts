/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Every neutral here sits between hue 250° and 261° — a violet family, held
 * deliberately, where most weather apps default to sky-blue. Additions should
 * stay in that family unless they are carrying meaning (see the umbrella pair
 * below).
 *
 * Contrast ratios quoted below are against the surface the colour is actually
 * used on, and all clear WCAG AA (4.5:1 for text, 3:1 for graphics).
 */
export const Colors = {
  light: {
    text: '#332F44',
    background: '#F8F6FB',
    backgroundElement: '#ECE7F5',
    backgroundSelected: '#DCD3EE',
    // 5.84:1 on backgroundElement, 4.91:1 on backgroundSelected. The previous
    // #7A7591 was 3.63:1 — under AA on every surface it was used on, which was
    // most timestamps, hints and labels in the app.
    textSecondary: '#5A5570',
    // 4.92:1 under white, and 4.58:1 as red text on the background — one value
    // covers both roles. The previous #E0645C was 3.42:1 under white.
    danger: '#C4453D',
    onDanger: '#FFFFFF',
    // Hue 156°, luminance-matched to `danger` — 4.92:1 under white and 4.59:1
    // as green text on the background, the same two ratios — so a confirmation
    // and a failure carry the same weight rather than one shouting over the
    // other. Used as an accent (the toast's glyph and outline), so the bar is
    // 3:1 for graphics: it scores 4.06:1 on `backgroundElement`. If anything
    // ever fills a surface with it, pair it with white here and with
    // `background` in dark, where white is 2.34:1 — the same trap `onDanger`
    // exists for.
    //
    // Green/red is the colour-vision-unsafe axis, and this is the one place
    // that's acceptable: only one toast is on screen at a time, so the two
    // never have to be separated side by side, and the glyph (checkmark vs.
    // triangle) and the message both carry the meaning without the hue. Data
    // uses the umbrella pair below instead.
    success: '#198057',
    // Hue 250.8° — the app's own hue at full saturation, so actions read as
    // "the app" and leave the chroma budget to the weather. 6.84:1 under white.
    primary: '#5B44C4',
    onPrimary: '#FFFFFF',
    // No longer an alias for `backgroundSelected`. As one it was 1.19:1 on a
    // card — the same invisible-divider problem the dark theme had, and the
    // reason `NearbyForecastPreview` had to fake its rule out of a surface
    // colour instead of using this token. #BBB4CF is 1.64:1 on
    // `backgroundElement` and 1.86:1 on `background`, matching the 1.61:1 the
    // dark `border` scores on its own card, so a divider reads the same weight
    // in both themes. Hue 255.6° — inside the 250–261° family like everything
    // else here.
    border: '#BBB4CF',
    // The umbrella pair. Blue/amber rather than the intuitive red/green: it is
    // the axis protanopia and deuteranopia leave intact, and here it is also
    // literal — rain is blue, sun is amber.
    umbrellaRain: '#2E6FB5',
    umbrellaSun: '#B2650A',
  },
  dark: {
    text: '#F3F1F8',
    // The dark surfaces are spread apart rather than stacked close together.
    // `background #201C2B` against `backgroundElement #2B2638` was **1.14:1** —
    // a step you cannot see, so a card had no edge and a list of plans read as
    // one flat sheet. Dropping the background to 8% lightness and lifting the
    // card to 22% makes it **1.43:1**, which is a visible boundary at the dark
    // end of the range without lighting up the whole screen.
    //
    // Contrast is bounded on both sides here: pushing the card lighter to widen
    // the step costs `textSecondary` on top of it, and pushing it past ~24%
    // takes the pressed state (`backgroundSelected`) under AA. 22/29% is where
    // both still clear 4.5:1 — see the ratios below.
    background: '#120F1A',
    backgroundElement: '#332C44',
    backgroundSelected: '#443A59',
    // 8.37:1 on background, 5.86:1 on backgroundElement, 4.65:1 on
    // backgroundSelected. Lifted from #A79FBF, which was 4.19:1 on the new
    // backgroundSelected — under AA once the surfaces moved.
    textSecondary: '#B0A8C8',
    danger: '#E8938D',
    // Not white: white on the dark theme's lighter danger is 2.34:1. Dark text
    // on it is 8.11:1. This is why onDanger is a token and not a constant.
    onDanger: '#120F1A',
    success: '#4CBD90',
    primary: '#B9A8F5',
    onPrimary: '#120F1A',
    // No longer an alias for `backgroundSelected` — a divider the same value as
    // the pressed state is invisible on a card. 2.30:1 on the background and
    // 1.61:1 on a card: a hairline, not a rule.
    border: '#54496E',
    umbrellaRain: '#7FB3E8',
    umbrellaSun: '#F0B45C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// Fixed so the Today/Plans tab headers are the same height regardless of
// their content (Today's title + date subtitle vs. Plans' title-only row) —
// otherwise switching tabs visually shifts the content below the header.
//
// 80 fits Today's stacked content — a 40pt `title` line over a 24pt `default`
// date line — with room left over, and clears the `+ Add` button's 44pt tap
// target on both tabs. It was 108, sized for the old 52pt title line.
export const HeaderHeight = 80;
