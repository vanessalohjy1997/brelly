import type { ReactNode } from "react";

import { Text } from "./Text";

/**
 * The app's one button, in three tones.
 *
 * It exists mostly to hold two things in one place that were repeated at every
 * call site on the phone and are easy to drop: the 44px minimum target, and the
 * `onPrimary`/`onDanger` pairing. Those two colours are separate tokens
 * precisely because white is not safe on both themes — the dark theme's
 * `danger` is the lighter of the pair, and white on it is 2.34:1 — so a button
 * that picks its own text colour is a button that will eventually pick white.
 *
 * `hitSlop` has no CSS equivalent: a target cannot be extended past its own
 * box. So where the phone puts a 20px glyph in a 20px box and adds slop, this
 * pads the box instead.
 */
type Tone = "primary" | "danger" | "quiet";

type Props = {
  tone?: Tone;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  /** For an icon-only button, where nothing visible names it. */
  label?: string;
  className?: string;
  children?: ReactNode;
};

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary",
  danger: "bg-danger",
  quiet: "bg-background-element",
};

const TONE_TEXT = {
  primary: "onPrimary",
  danger: "onDanger",
  quiet: "text",
} as const;

export function Button({
  tone = "primary",
  onClick,
  disabled = false,
  type = "button",
  label,
  className,
  children,
}: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "inline-flex min-h-[var(--brelly-hit-target)] items-center justify-center gap-two rounded-control px-three py-two",
        TONE_CLASS[tone],
        // `disabled:` rather than a conditional class, so the visual state and
        // the actual state cannot disagree.
        "disabled:opacity-[var(--brelly-opacity-disabled)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Text variant="smallBold" color={TONE_TEXT[tone]}>
        {children}
      </Text>
    </button>
  );
}
