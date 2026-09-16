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

/**
 * Shared by every tone, and by the handful of `next/link`s shaped like buttons.
 *
 * Two of these are web-only affordances the phone never needed. A touch target
 * is pressed because it looks pressable and there is nothing else it could be;
 * a pointer has a cursor and a hover state, and a control that changes under
 * neither reads as decoration. Tailwind's reset gives `<button>`
 * `cursor: default`, so `cursor-pointer` has to be asked for.
 *
 * `border` with no colour is here rather than on `quiet` alone: only `quiet`
 * shows its edge, but a tone whose box is 2px shorter than its neighbour's is
 * a row of buttons that do not line up.
 */
const BASE_CLASS =
  "inline-flex min-h-[var(--brelly-hit-target)] cursor-pointer items-center justify-center gap-two rounded-control border px-three py-two transition-colors duration-[var(--brelly-duration-fade)]";

/**
 * `quiet` is the one that needed fixing, and the fix is an outline.
 *
 * It was `bg-background-element` and nothing else — the same fill as the
 * `Surface` it almost always sits inside, so on Settings it rendered as a
 * label floating on a card with no edge of any kind. `background-selected` as
 * a fill would not have helped: it is 1.19:1 on a card, which is the same
 * invisible step the `border` token was introduced to solve. So the edge is
 * that token, at 1.64:1 on a card and 1.86:1 on the page — a visible boundary
 * in both themes — and `background-selected` does the job it is named for
 * instead, as the hover fill.
 */
const TONE_CLASS: Record<Tone, string> = {
  primary: "border-transparent bg-primary",
  danger: "border-transparent bg-danger",
  quiet: "border-border bg-background-element hover:bg-background-selected",
};

const TONE_TEXT = {
  primary: "onPrimary",
  danger: "onDanger",
  quiet: "text",
} as const;

/**
 * The button's look without the `<button>`, for the three places that are
 * genuinely a link — a navigation that should middle-click, open in a tab and
 * show its target in the status bar. Each of those had hand-copied a subset of
 * the classes above, which is how one of them ended up with no text colour at
 * all.
 */
export function buttonClassName(tone: Tone = "primary", className?: string) {
  return [BASE_CLASS, TONE_CLASS[tone], className].filter(Boolean).join(" ");
}

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
      className={buttonClassName(
        tone,
        // `disabled:` rather than a conditional class, so the visual state and
        // the actual state cannot disagree. The cursor is part of that state:
        // `cursor-pointer` on something that will not respond is a lie.
        [
          "disabled:cursor-not-allowed disabled:opacity-[var(--brelly-opacity-disabled)]",
          className,
        ]
          .filter(Boolean)
          .join(" "),
      )}
    >
      {/* The flex row is on the label, not the `<button>`: every child goes
          inside one `Text`, so the button's own `items-center gap-two` had a
          single item to centre and no pair to space. An icon beside a label is
          inline content otherwise, and an inline box sits on the baseline —
          which is the bottom of the text, not its middle. */}
      <Text
        variant="smallBold"
        color={TONE_TEXT[tone]}
        className="inline-flex items-center gap-two"
      >
        {children}
      </Text>
    </button>
  );
}
