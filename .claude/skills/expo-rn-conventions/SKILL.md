---
name: expo-rn-conventions
description: Project conventions and stack-specific gotchas for Brelly, a React Native (Expo, TypeScript) weather-by-itinerary app for Singapore. Use this whenever writing, reviewing, or scaffolding code for Brelly — components, screens, navigation, native module usage, EAS build/config questions, or Expo SDK upgrade decisions. Keeps generated code consistent with the project's existing structure and avoids re-deriving Expo managed-workflow gotchas from scratch each session.
---

# Brelly — Expo/React Native Conventions

Stack: Expo (managed workflow, SDK 57), expo-router, TypeScript, Zustand,
TanStack Query v5, react-native-mmkv, React Native Firebase (auth +
firestore), NEA open data APIs, Open-Meteo, Google Places.

Read the versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/
before writing code against an Expo API — the SDK has changed.

## Project structure

This is the real tree. Put new files where their neighbours already are.

```
src/
  app/            # expo-router routes — (tabs)/, plan/[id].tsx, _layout.tsx
  components/     # shared primitives at top level, domain folders below
    itinerary/    # ItineraryCard, SlotForm, WeekStrip, RepeatField, …
    weather/      # WeatherBadge, WeatherIcon, LiveConditionsCard, …
  constants/      # theme.ts (design tokens), neaRegions.ts
  hooks/          # custom hooks — including every TanStack Query hook
  services/       # network + platform clients: NEA, Open-Meteo, Firebase,
                  # notifications, calendar, and the *Sync.ts Firestore layer
  store/          # zustand stores (singular "store"), mmkvStorage.ts
  test/           # shared test helpers, plus test/screens/ route-level tests
  types/          # shared domain types: itinerary.ts, routine.ts, weather.ts
  utils/          # pure functions — formatters, selectors, date maths
```

There is **no** `src/features/`, `src/queries/`, `src/api/`, or `src/lib/`.
Fetch clients go in `services/`, query hooks in `hooks/`, pure helpers in
`utils/`. Don't introduce a parallel folder for work that fits one of these.

- Imports use the `@/*` path alias (`@/services/weather`), never deep
  relative paths.
- Routes in `src/app/` stay thin — a route composes components and hooks;
  substantial logic belongs in a hook or a util that can be tested directly.

## TypeScript conventions

- Strict mode on. No `any` — use `unknown` and narrow, or define a type.
- Shared domain types live in `src/types/`. A type used by one module stays
  in that module and is exported from it (`SlotForecast` from
  `@/services/weather` is the pattern).
- Don't leak raw API field names past the service layer. `services/` parses
  and returns a clean domain shape; nothing above it sees the wire format.

## Component conventions

- Functional components only. Props typed with an explicit
  `type ComponentNameProps`, destructured in the signature.
- One component per file. Filename casing follows the folder: domain folders
  use PascalCase matching the export (`weather/WeatherBadge.tsx`), top-level
  shared primitives are mostly camelCase (`themedText.tsx`, `icon.tsx`,
  `toast.tsx`). Match the folder you're adding to.
- Keep components presentational. Fetching happens in a hook, not inside a
  nested component.
- **Styling is not freehand** — every colour, space, radius, icon and text
  size comes from a token. Read the
  [ui-implementation](../ui-implementation/SKILL.md) skill before writing any
  style. Static styles go in `StyleSheet.create` at the bottom of the file;
  colour is a runtime value from `useTheme()` and belongs in the inline style
  array.

## Native modules & Expo managed workflow gotchas

- Use `npx expo install <package>`, not `npm`/`yarn add`, for anything
  touching native code — it pins the version compatible with the SDK. Bare
  installs are the top source of "works locally, crashes in EAS build".
- `expo-notifications`, `expo-location`, `expo-calendar` and friends need
  plugin entries in `app.json`/`app.config.ts`. Installed ≠ configured.
- MMKV and React Native Firebase both require a custom dev client — neither
  runs in Expo Go. "MMKV undefined" is almost always this.
- Native modules can't load in Jest. When a util would otherwise import one,
  declare the dependency structurally and inject it — see
  [forecastCache.ts](src/utils/forecastCache.ts), which takes a `CacheStorage`
  rather than importing `mmkvStorage`.

## EAS Build

- Profiles in `eas.json`: `development` (dev client, internal), `preview`
  (internal distribution), `production` (store-ready).
- Submission authenticates with an App Store Connect API key, not
  placeholder credentials in `eas.json`.

## Networking / API layer

- Fetch clients live in `src/services/` and return typed, parsed data. No
  `fetch` inside a component or a Zustand store.
- Every external call goes through a TanStack Query hook in `src/hooks/` —
  see [zustand-tanstack-conventions](../zustand-tanstack-conventions/SKILL.md).
- For NEA response shapes and quirks, see
  [nea-weather-api](../nea-weather-api/SKILL.md).

## Testing

Jest + React Native Testing Library. Tests co-locate as `<name>.test.ts(x)`
next to the file they cover; route-level tests live in `src/test/screens/`.
Shared harnesses (`renderWithProviders`, `fakeFirestore`, `fakeAuth`) are in
`src/test/`.

The full definition of done — `npx tsc --noEmit`, `yarn lint` at zero
warnings, `yarn test`, and a test for every new component and function — is
in [implement-feature](../implement-feature/SKILL.md).

## Commits

Per `AGENTS.md`, every branch and commit starts with `feat`, `fix`, or
`chore` — those three only. Say what changed in the subject, not that
something changed.
