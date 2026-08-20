---
name: ui-implementation
description: Use whenever writing or changing UI in this repo (brelly) — a screen, component, StyleSheet, colour, spacing, font size, icon size, or border radius. UI must be built from the declared design tokens in src/constants/theme.ts so it stays uniform across the app; a value that has no token is a stop-and-ask, never a new literal.
---

# UI implementation

UI in this repo is standardised. Every colour, size, space and radius comes
from a declared constant, so the same thing looks the same everywhere. Two
rules follow from that, and neither has an exception:

1. **Never write a raw value in a style.** No hex colours, no `rgba(...)`, no
   bare numbers for padding, margin, gap, radius, icon size, or font size.
   Use the token.
2. **If no token fits, stop and ask the user before adding one.** Do not
   invent a token, and do not quietly drop a literal in "just this once".
   Describe what you need and why nothing existing covers it, then wait.

## The tokens

All of these live in [theme.ts](src/constants/theme.ts) unless noted.

| Token | Use for |
| --- | --- |
| `Colors.light` / `Colors.dark` | every colour — read via `useTheme()`, never index `Colors` directly |
| `Fonts` | font families (`sans`, `serif`, `rounded`, `mono`) |
| `Spacing` | padding, margin, gap, and border radius |
| `IconSize` | every icon's `size` prop |
| `BottomTabInset` | bottom padding on scrollable content behind the tab bar |
| `MaxContentWidth`, `HeaderHeight` | page layout |
| `DateTimePickerWidth` | in [shouldStackDateTimeFields.ts](src/utils/shouldStackDateTimeFields.ts) |

Text sizes are **not** a token table — they are the `type` variants on
[ThemedText](src/components/themedText.tsx) (`default`, `title`, `small`,
`smallBold`, `subtitle`, `link`, `linkPrimary`, `code`, `eyebrow`,
`fieldLabel`). Render text through `ThemedText` with a `type`; never set
`fontSize` on a `Text` in a screen's own StyleSheet.

## How to use them

- **Colour:** `const theme = useTheme()` from
  [useTheme.ts](src/hooks/useTheme.ts), then `theme.textSecondary`. This
  respects the user's light/dark override. Colour is a runtime value, so it
  belongs in the inline style array, not in `StyleSheet.create`.
- **Surfaces:** `<ThemedView type="backgroundElement">` rather than a
  hand-set `backgroundColor`.
- **Pairs are pairs.** `onPrimary` goes on `primary` and `onDanger` goes on
  `danger` — they are separate tokens precisely because white is not safe on
  both themes. Never substitute `#FFFFFF`.
- **Radius reuses `Spacing`.** The established convention is `Spacing.two`
  for controls, rows, chips and inputs, and `Spacing.three` for cards. Match
  the neighbours.
- **Icons:** pass `IconSize.*`, and read the emphasis note in `theme.ts`
  before picking between `control` / `controlEmphasis` and `hero` /
  `heroEmphasis`.

## Before you add a token

Ask first. When you ask, give the user:

- the exact value and the name you'd give it,
- where it will be used,
- which existing tokens you considered and why each one is wrong.

Usually one of them isn't wrong and the answer is to use it — that check is
the point of the gate.

If the user approves a new **colour**, it carries obligations the sizes don't:

- Both themes. A light value without a dark one is a half-added token.
- Stay in the 250°–261° violet family unless the colour is carrying meaning
  (the `umbrellaRain` / `umbrellaSun` pair is the example).
- Document the contrast ratio in a comment, against the surface it is
  actually used on — WCAG AA, 4.5:1 for text and 3:1 for graphics. Every
  colour in `theme.ts` has this comment; a new one without it will be the
  odd one out, and past contrast regressions in this app were caught only
  because the ratios were written down.

## Checks before you're done

- `grep` your diff for hex codes, `rgba(`, and numeric literals in style
  properties. There should be none outside `theme.ts`.
- The screen looks right in **both** light and dark, not just the one you
  were working in.
- Then the usual gate — see [implement-feature](../implement-feature/SKILL.md)
  for the full definition of done: `npx tsc --noEmit`, `yarn lint`,
  `yarn test`, plus a test for every new component.
- If the change addresses an item in `UX.md`, tick it there.
