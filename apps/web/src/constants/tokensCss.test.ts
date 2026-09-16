import { Colors, Radius, Spacing } from "@/constants/theme";

import { buildTokensCss, kebab } from "./tokensCss";

const css = buildTokensCss();

describe("kebab", () => {
  it("splits a camelCase token name for CSS", () => {
    expect(kebab("backgroundElement")).toBe("background-element");
    expect(kebab("umbrellaRain")).toBe("umbrella-rain");
    expect(kebab("control")).toBe("control");
  });
});

describe("buildTokensCss", () => {
  it("emits every colour in the palette, both themes", () => {
    // Enumerated from `Colors` rather than listed here: a colour added to core
    // and forgotten on the web is exactly the drift one palette was supposed
    // to end, and a hand-written list would not notice it.
    for (const name of Object.keys(Colors.light)) {
      expect(css).toContain(`--brelly-${kebab(name)}: ${Colors.light[name as keyof typeof Colors.light]};`);
      expect(css).toContain(`--brelly-${kebab(name)}: ${Colors.dark[name as keyof typeof Colors.dark]};`);
    }
  });

  it("puts the light palette on bare :root, so a document with no signal is still styled", () => {
    const rootBlock = css.slice(0, css.indexOf("@media"));
    expect(rootBlock).toContain(`--brelly-background: ${Colors.light.background};`);
    expect(rootBlock).toContain("color-scheme: light;");
  });

  it("lets an explicit light choice beat the system's dark preference", () => {
    // Without the `:not([data-theme=\"light\"])` guard the media query wins on
    // specificity ties and the user's own setting silently does nothing on a
    // dark-mode machine.
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"])',
    );
  });

  it("lets an explicit dark choice beat a light system", () => {
    const explicitDark = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(explicitDark).toContain(`--brelly-background: ${Colors.dark.background};`);
    expect(explicitDark).toContain("color-scheme: dark;");
  });

  it("carries the scales in CSS units, not bare numbers", () => {
    expect(css).toContain(`--brelly-space-three: ${Spacing.three}px;`);
    expect(css).toContain(`--brelly-radius-card: ${Radius.card}px;`);
    expect(css).toContain("--brelly-hit-target: 44px;");
    expect(css).toContain("--brelly-duration-toast-with-action: 6000ms;");
  });

  it("keeps unitless tokens unitless", () => {
    // `z-index` and `opacity` take no unit, and `1px` would be ignored
    // silently — the element simply stops stacking.
    expect(css).toContain("--brelly-z-dropdown: 20;");
    expect(css).toContain("--brelly-opacity-disabled: 0.5;");
  });

  it("spells the one shadow from its measured parts", () => {
    expect(css).toContain(
      "--brelly-shadow-dropdown: 0 6px 12px rgb(0 0 0 / 0.25);",
    );
  });

  it("gives every text variant a full set of properties", () => {
    expect(css).toContain("--brelly-text-title-size: 34px;");
    expect(css).toContain("--brelly-text-title-line: 40px;");
    expect(css).toContain("--brelly-text-eyebrow-transform: uppercase;");
    expect(css).toContain("--brelly-text-eyebrow-tracking: 0.6px;");
    // A variant with no line height of its own says `normal` rather than
    // omitting the property, so a consumer can use it unconditionally.
    expect(css).toContain("--brelly-text-code-line: normal;");
    expect(css).toContain("--brelly-text-code-family: var(--brelly-font-mono);");
  });

  it("emits no raw colour outside the palette", () => {
    // The gate the ui-implementation skill asks for, enforced rather than
    // grepped by hand: every hex in this file has to be a token's value.
    const palette = new Set<string>([
      ...Object.values(Colors.light),
      ...Object.values(Colors.dark),
    ]);
    const hexes = css.match(/#[0-9A-Fa-f]{3,8}/g) ?? [];
    expect(hexes.length).toBeGreaterThan(0);
    for (const hex of hexes) expect(palette).toContain(hex);
  });
});
