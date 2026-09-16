import {
  Colors,
  Duration,
  Elevation,
  Fonts,
  HeaderHeight,
  HitTarget,
  IconSize,
  MaxContentWidth,
  Opacity,
  Radius,
  Spacing,
  TextStyles,
  ZIndex,
} from "@/constants/theme";

/**
 * The design tokens as CSS custom properties, built from the TypeScript that
 * defines them.
 *
 * This is the "build step" the plan called for, and it is a *render* step
 * instead — the root layout emits the result into `<head>` on the server. The
 * trade was made on purpose. A generated-and-committed `.css` file needs a
 * script, a place in the build order, and a check that the committed copy is
 * current; get any of the three wrong and the two apps quietly stop sharing a
 * palette, which is the one failure this whole arrangement exists to prevent.
 * Emitting at render makes the TypeScript the only copy there is, and costs
 * about two kilobytes of highly compressible text per document.
 *
 * Dark mode ships as three layers, and the order matters:
 *
 *   1. `:root` carries the light palette, so a document with no signal at all
 *      renders light rather than unstyled;
 *   2. `prefers-color-scheme: dark` overrides it, guarded by
 *      `:not([data-theme="light"])` so an explicit light choice still wins;
 *   3. `[data-theme="dark"]` overrides both, for an explicit dark choice under
 *      a light system.
 *
 * `themePreference` arrives from **Firestore**, not from storage, so the first
 * paint of a first visit cannot know it — see `ThemeScript` for the cookie that
 * narrows that window and for an honest account of what it cannot fix.
 */

/** `--brelly-*`, not `--color-*`: the Tailwind theme maps onto these, not the other way round. */
const PREFIX = "--brelly";

function declarations(entries: [string, string][]): string {
  return entries.map(([name, value]) => `  ${name}: ${value};`).join("\n");
}

function colorVars(scheme: "light" | "dark"): [string, string][] {
  return Object.entries(Colors[scheme]).map(([name, value]) => [
    `${PREFIX}-${kebab(name)}`,
    value,
  ]);
}

/** `backgroundElement` → `background-element`, so the CSS reads as CSS. */
export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function scaleVars(): [string, string][] {
  return [
    ...Object.entries(Spacing).map(
      ([name, value]): [string, string] => [
        `${PREFIX}-space-${name}`,
        `${value}px`,
      ],
    ),
    ...Object.entries(Radius).map(
      ([name, value]): [string, string] => [
        `${PREFIX}-radius-${name}`,
        `${value}px`,
      ],
    ),
    ...Object.entries(IconSize).map(
      ([name, value]): [string, string] => [
        `${PREFIX}-icon-${kebab(name)}`,
        `${value}px`,
      ],
    ),
    ...Object.entries(ZIndex).map(
      ([name, value]): [string, string] => [`${PREFIX}-z-${name}`, `${value}`],
    ),
    ...Object.entries(Opacity).map(
      ([name, value]): [string, string] => [
        `${PREFIX}-opacity-${name}`,
        `${value}`,
      ],
    ),
    ...Object.entries(Duration).map(
      ([name, value]): [string, string] => [
        `${PREFIX}-duration-${kebab(name)}`,
        `${value}ms`,
      ],
    ),
    ...Object.entries(Fonts).map(
      ([name, value]): [string, string] => [`${PREFIX}-font-${name}`, value],
    ),
    [`${PREFIX}-hit-target`, `${HitTarget.minimum}px`],
    [`${PREFIX}-max-content-width`, `${MaxContentWidth}px`],
    [`${PREFIX}-header-height`, `${HeaderHeight}px`],
    // One shadow, spelled from its measured parts so the numbers stay in one
    // place rather than becoming a string nobody can trace back.
    [
      `${PREFIX}-shadow-dropdown`,
      `0 ${Elevation.dropdown.offsetY}px ${Elevation.dropdown.blur}px rgb(0 0 0 / ${Elevation.dropdown.opacity})`,
    ],
  ];
}

function textVars(): [string, string][] {
  return Object.entries(TextStyles).flatMap(
    ([variant, metrics]): [string, string][] => {
      const base = `${PREFIX}-text-${kebab(variant)}`;
      return [
        [`${base}-size`, `${metrics.fontSize}px`],
        [`${base}-weight`, `${metrics.fontWeight}`],
        // A variant with no line height of its own inherits the document's,
        // which is what the phone does too: `code`, `eyebrow` and `fieldLabel`
        // each sit in a row sized by something else, and pinning a line height
        // there fights that.
        [`${base}-line`, metrics.lineHeight ? `${metrics.lineHeight}px` : "normal"],
        [`${base}-tracking`, metrics.letterSpacing ? `${metrics.letterSpacing}px` : "normal"],
        [`${base}-transform`, metrics.uppercase ? "uppercase" : "none"],
        [`${base}-family`, metrics.mono ? `var(${PREFIX}-font-mono)` : `var(${PREFIX}-font-sans)`],
      ];
    },
  );
}

export function buildTokensCss(): string {
  const light = declarations([
    ...colorVars("light"),
    ...scaleVars(),
    ...textVars(),
  ]);
  const dark = declarations(colorVars("dark"));

  return `:root {
  color-scheme: light;
${light}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${dark.replace(/^ {2}/gm, "    ")}
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
${dark}
}
`;
}
