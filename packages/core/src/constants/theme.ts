/**
 * The design tokens both apps are built from.
 *
 * They live here, in core, for the reason the palette comments below give at
 * length: these values are decisions with evidence attached — measured contrast
 * ratios, a hue family held on purpose, icon sizes on two deliberate grids —
 * and a second copy of them is a second place for that evidence to rot. A
 * colour changed on one side only should be impossible rather than merely
 * discouraged.
 *
 * What is *not* here is the platform-dirty remainder, which each app keeps in
 * its own `constants/theme.ts`: `Fonts` and `BottomTabInset` are
 * `Platform.select` calls, and the mobile file additionally imports the global
 * stylesheet for its side effect. Both apps re-export this module, so a token
 * is still reached as `@/constants/theme` from either side.
 */

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

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// Icon sizes step in two grids. Below `hero` they're a tight 4px ladder —
// these sit right next to text, so they need to track it closely. From
// `hero` up they widen (48 → 96) because these are standalone marks, not
// text companions, and at that size a small delta isn't visible anyway.
//
// `controlEmphasis` and `heroEmphasis` aren't a size up for their own sake —
// they exist because `UmbrellaVerdictIcon`'s umbrella-and-marks reads
// visually lighter than a filled symbol at the same nominal size (see
// `RAIN_DROPS_COMPACT` in that file), so wherever it sits beside a
// `WeatherIcon` at `control`/`hero`, it takes the next step up instead to
// match visual weight.
export const IconSize = {
  /** Decorative glyphs beside caption-scale text — timestamps, indoor/muted/repeat markers. */
  metadata: 12,
  /** Icons inline with body text — chips, warnings, checkmarks, form field icons. */
  inline: 16,
  /** Standalone control icons — buttons, row actions, headings. */
  control: 20,
  /** `control`, one step up — see the emphasis note above. */
  controlEmphasis: 24,
  /** A lead icon beside a title/subtitle block, with no companion icon to size-match. */
  lead: 32,
  /** Empty-state and other focal illustration icons. */
  hero: 48,
  /** `hero`, one step up — see the emphasis note above. */
  heroEmphasis: 56,
  /** A large background mark bleeding off a card's own corner. */
  watermark: 96,
} as const;

export const MaxContentWidth = 800;

// Fixed so the Today/Plans tab headers are the same height regardless of
// their content (Today's title + date subtitle vs. Plans' title-only row) —
// otherwise switching tabs visually shifts the content below the header.
//
// 80 fits Today's stacked content — a 40pt `title` line over a 24pt `default`
// date line — with room left over, and clears the `+ Add` button's 44pt tap
// target on both tabs. It was 108, sized for the old 52pt title line.
export const HeaderHeight = 80;

/**
 * Corner radii.
 *
 * Previously "radius reuses `Spacing`", which was true of 34 of the 37 sites
 * and hid the other three. A census of the app found `Spacing.two` 31 times,
 * `Spacing.three` 3 times, a hairline `1`, a full pill, and one off-grid `10`
 * in `WeekStrip`. Naming the four that carry meaning is what lets the fifth be
 * recognised as the accident it was.
 *
 * `control` and `card` keep the numbers `Spacing.two`/`Spacing.three` already
 * had, so nothing on the phone moves by adopting these. `WeekStrip`'s 10 folds
 * into `control`: one call site is not a scale step, and a ladder with a rung
 * between 8 and 16 for a single cell is harder to hold than the two-pixel
 * difference is worth.
 */
export const Radius = {
  /** A rule that should read as a line, not a shape — a divider's own ends. */
  hairline: 1,
  /** Chips, inputs, rows, buttons — anything the finger presses. */
  control: 8,
  /** A card, which is a surface rather than a control. */
  card: 16,
  /** A pill. Large enough to round any height this app produces. */
  full: 9999,
} as const;

/**
 * Stacking order, as a short list rather than a set of magic numbers.
 *
 * The values are the app's own: `1` and `10` come from `SlotForm`, where the
 * location field has to paint over the "Use my location" row *and* its own
 * dropdown has to paint over the field below it — two different problems that
 * looked like one until they were named. `dropdown` is new and exists because
 * the web place-search list is absolutely positioned over the next field, which
 * on a phone was handled by `elevation` instead.
 */
export const ZIndex = {
  /** Lifts a positioned element over its own later siblings. */
  raised: 1,
  /** A form field that must paint over the row beneath it. */
  field: 10,
  /** A list or menu floating over the field that opened it. */
  dropdown: 20,
  /** Modal dialogs, toasts, and anything else that owns the screen. */
  overlay: 1000,
} as const;

/**
 * The two opacities that carry meaning, both already in use and neither named.
 *
 * `watermark` is the large mark bleeding off a card's corner — low enough to
 * stay under the text it sits behind at every theme. `disabled` is the standard
 * "this control is not available"; it is a token rather than a literal because
 * a control at half opacity still has to clear contrast, and changing it is a
 * decision about that rather than about taste.
 */
export const Opacity = {
  watermark: 0.14,
  disabled: 0.5,
} as const;

/**
 * The one shadow in the app, from `SlotForm`'s place-search dropdown.
 *
 * Kept as its measured parts rather than a CSS string so both platforms can
 * spell it their own way — React Native wants four props, CSS wants one. A
 * dropdown floats over the form, so it needs to look like it: the hairline
 * border and this shadow together are what separate it from the input it covers.
 */
export const Elevation = {
  dropdown: {
    offsetY: 6,
    blur: 12,
    /** Black at this alpha, on both themes: a shadow is an absence of light. */
    opacity: 0.25,
  },
} as const;

/**
 * Timings, in milliseconds.
 *
 * `fade` is the toast's entrance and exit. The two toast lifetimes are not
 * symmetrical and should not be made so: a toast carrying an Undo is the only
 * way back from a delete, so what is added is time to *decide*, on top of the
 * same time to read.
 */
export const Duration = {
  fade: 160,
  toast: 3200,
  toastWithAction: 6000,
} as const;

/**
 * The floor for anything the finger has to hit — 44, Apple's own figure, and
 * the one already spelled as a literal at eleven sites across eight files.
 *
 * On the phone it is a `minHeight` plus `hitSlop`. In a browser it is padding,
 * because there is no `hitSlop`: a target cannot be extended past its own box.
 */
export const HitTarget = {
  minimum: 44,
} as const;

/**
 * The text scale, as the ten variants `ThemedText` already defines rather than
 * a table of sizes.
 *
 * That distinction is the whole design. A census found 40 loose `fontSize`
 * declarations outside `ThemedText`, at eight different sizes across six
 * screens and eleven components — and they are debt, not a scale. Publishing
 * them as tokens would make the debt permanent by giving each accident a name.
 * A variant says what the text *is*; a size says only how big it is.
 *
 * `code` carries no `lineHeight` and `eyebrow`/`fieldLabel` carry none either,
 * exactly as in `ThemedText`: each sits inside a row whose height is set by
 * something else, and pinning a line height there fights that.
 */
export type TextVariant =
  | "default"
  | "title"
  | "small"
  | "smallBold"
  | "subtitle"
  | "link"
  | "linkPrimary"
  | "code"
  | "eyebrow"
  | "fieldLabel";

export type TextMetrics = {
  fontSize: number;
  lineHeight?: number;
  fontWeight: number;
  letterSpacing?: number;
  uppercase?: boolean;
  mono?: boolean;
};

export const TextStyles: Record<TextVariant, TextMetrics> = {
  /** Screen headers — "Today", "Plans". */
  title: { fontSize: 34, lineHeight: 40, fontWeight: 600 },
  /** Empty-state headlines and section titles. */
  subtitle: { fontSize: 24, lineHeight: 30, fontWeight: 600 },
  default: { fontSize: 16, lineHeight: 24, fontWeight: 500 },
  small: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: 700 },
  link: { fontSize: 14, lineHeight: 30, fontWeight: 400 },
  linkPrimary: { fontSize: 14, lineHeight: 30, fontWeight: 600 },
  code: { fontSize: 12, fontWeight: 500, mono: true },
  /** A small-caps section heading — "Right now", "Nearby". */
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, uppercase: true },
  /** A form field's own label, one step up from `eyebrow` and untracked. */
  fieldLabel: { fontSize: 12, fontWeight: 600, uppercase: true },
};
