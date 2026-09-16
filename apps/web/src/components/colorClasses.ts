import type { ThemeColor } from "@/constants/theme";

/**
 * Palette token → Tailwind class.
 *
 * A lookup rather than a template string, and that is the whole point: Tailwind
 * scans source text for class names it can see, so `` `text-${color}` `` compiles
 * to nothing at all — a silently colourless element. Every class the app can
 * use has to appear literally somewhere, and this is that somewhere.
 *
 * `Record<ThemeColor, string>` is what keeps it complete: a colour added to
 * core and not mapped here fails `tsc` rather than rendering untinted.
 */
export const TEXT_COLOR: Record<ThemeColor | "inherit", string> = {
  inherit: "text-inherit",
  text: "text-text",
  textSecondary: "text-text-secondary",
  background: "text-background",
  backgroundElement: "text-background-element",
  backgroundSelected: "text-background-selected",
  danger: "text-danger",
  onDanger: "text-on-danger",
  success: "text-success",
  primary: "text-primary",
  onPrimary: "text-on-primary",
  border: "text-border",
  umbrellaRain: "text-umbrella-rain",
  umbrellaSun: "text-umbrella-sun",
};

export const BG_COLOR: Record<ThemeColor, string> = {
  text: "bg-text",
  textSecondary: "bg-text-secondary",
  background: "bg-background",
  backgroundElement: "bg-background-element",
  backgroundSelected: "bg-background-selected",
  danger: "bg-danger",
  onDanger: "bg-on-danger",
  success: "bg-success",
  primary: "bg-primary",
  onPrimary: "bg-on-primary",
  border: "bg-border",
  umbrellaRain: "bg-umbrella-rain",
  umbrellaSun: "bg-umbrella-sun",
};
