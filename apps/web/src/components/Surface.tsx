import type { ReactNode } from "react";

import type { ThemeColor } from "@/constants/theme";

/**
 * A filled panel — `ThemedView`'s web twin, narrowed to the one job it actually
 * does here.
 *
 * On the phone `ThemedView` exists because every `View` needs its background
 * colour handed to it; CSS inherits, so most of those wrappers are plain
 * `<div>`s here and only the ones that genuinely *are* a surface use this.
 *
 * `radius` defaults to `card`, which is the established convention: `card` for
 * surfaces, `control` for things the finger presses.
 */
type Props = {
  color?: Extract<ThemeColor, "background" | "backgroundElement" | "backgroundSelected">;
  radius?: "card" | "control" | "none";
  as?: "div" | "section" | "article" | "li" | "aside";
  className?: string;
  children?: ReactNode;
};

const COLOR_CLASS = {
  background: "bg-background",
  backgroundElement: "bg-background-element",
  backgroundSelected: "bg-background-selected",
} as const;

const RADIUS_CLASS = {
  card: "rounded-card",
  control: "rounded-control",
  none: "",
} as const;

export function Surface({
  color = "backgroundElement",
  radius = "card",
  as: Component = "div",
  className,
  children,
}: Props) {
  return (
    <Component
      className={[COLOR_CLASS[color], RADIUS_CLASS[radius], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Component>
  );
}
