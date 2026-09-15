import type { ElementType, ReactNode } from "react";

import type { TextVariant, ThemeColor } from "@/constants/theme";

import { TEXT_COLOR } from "./colorClasses";

/**
 * `ThemedText`'s web twin, and the reason the text scale is ten variants rather
 * than a table of sizes: a variant says what the text *is*, so it can carry a
 * size, a line height, a weight and a transform together and cannot be
 * half-applied.
 *
 * Two things it has that the phone's version does not, both because this is a
 * document rather than a view tree:
 *
 * - **`as`**. Nothing in `src/app` uses `accessibilityRole="header"`, so there
 *   is no heading hierarchy to port — it has to be invented here, and a
 *   document with no `<h1>` is one a screen reader cannot navigate. The element
 *   is therefore a separate decision from the size, which is why `as` is not
 *   derived from `variant`: `title` is the `<h1>` on a page and a `<h2>` inside
 *   a dialog, at the same size in both.
 * - **`uppercase`**, applied by variant rather than asked for. `eyebrow` and
 *   `fieldLabel` are small-caps headings by definition; leaving it to the call
 *   site is how the phone ended up with the transform on some of them.
 */
type Props = {
  variant?: TextVariant;
  /**
   * A palette token, or `"inherit"` to take the colour of whatever encloses it.
   * Defaults to `text`, or `primary` for `linkPrimary`.
   *
   * `"inherit"` exists for one recurring shape: a link or button that colours
   * itself — a selected nav item, a danger row — and whose label should follow
   * without being told the same colour twice. Naming it at both levels is how
   * the two drift apart.
   */
  color?: ThemeColor | "inherit";
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  id?: string;
};

const VARIANT_CLASS: Record<TextVariant, string> = {
  default: "text-default",
  title: "text-title",
  subtitle: "text-subtitle",
  small: "text-small",
  smallBold: "text-small-bold",
  link: "text-link",
  linkPrimary: "text-link-primary",
  code: "text-code font-mono",
  eyebrow: "text-eyebrow uppercase",
  fieldLabel: "text-field-label uppercase",
};


export function Text({
  variant = "default",
  color,
  as: Component = "span",
  className,
  children,
  id,
}: Props) {
  // `linkPrimary` has no colour of its own: it takes the theme's primary, so it
  // adapts per theme instead of being one hardcoded violet that was marginal
  // for contrast in both.
  const resolved = color ?? (variant === "linkPrimary" ? "primary" : "text");

  return (
    <Component
      id={id}
      className={[VARIANT_CLASS[variant], TEXT_COLOR[resolved], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Component>
  );
}
