# Brelly implementation plan

Brelly shows Singapore weather (via `data.gov.sg` NEA APIs) for user-planned
itinerary stops (via Google Places).

## Verification gate

Run before checking off any item below, and after every change:

```
npx tsc --noEmit
yarn lint
yarn test
```

All three must be clean — `yarn lint` runs with `--max-warnings 0`, so a
single warning fails it. See the `implement-feature` skill
(`.claude/skills/implement-feature/SKILL.md`) for the full policy: zero
lint warnings/errors, and a test for every new component and function.

## Done

- [x] NEA weather service (2hr nowcast / 24hr / 4-day tiers) — fixed to match
      the _actual_ `data.gov.sg` response shapes (forecast strings are nested
      `{code, text}` objects, not bare strings; 2hr uses `forecasts[].area`
      not `areas[].name`; 4-day dates live in `timestamp` not `date`).
- [x] 2hr nowcast area matching — now nearest-NEA-area-by-coordinates using
      the live `area_metadata` lat/lng, instead of unused/broken name matching.
- [x] Google Places autocomplete + details (session-token billing correct).
- [x] Zustand + MMKV itinerary store, with a `findSlotById` selector.
- [x] Routing: `(tabs)` group (Today, Plans) + root `Stack` with `plan/new`
      and `plan/[id]` presented as modals.
- [x] `SlotForm` (label, location autocomplete, start/end datetime pickers
      via `@expo/ui`), used by both add and edit screens.
- [x] Plans tab — all days' plans grouped by date, reusing `ItineraryCard`.
- [x] `WeatherIcon` (SF Symbols / Material Symbols) wired into `WeatherBadge`,
      replacing the emoji mapping.
- [x] Removed dead Expo Router starter boilerplate (`Collapsible`,
      `ExternalLink`, `WebBadge`, `HintRow`) and the non-functional
      `extra.googlePlacesKey` app.json entry (nothing read it — the real key
      flows through `EXPO_PUBLIC_GOOGLE_PLACES_KEY` inlined by Metro).
- [x] Test suite (`jest` + `jest-expo`, `yarn test`). Covers
      `getForecastForSlot`'s tier selection (2hr/24hr/4day/unavailable, plus
      one fallthrough case) and `findNearestArea`'s coordinate matching,
      against fixtures mirroring the real API shapes. `jest` is pinned to
      `^29.7.0` — `jest-expo@57` depends on internals (`jest-mock`'s
      `clearMocksOnScope`) that don't exist in Jest 30; installing latest
      `jest` breaks test-suite loading with an opaque `TypeError`. `tsconfig`
      needed an explicit `"types": ["jest"]` — without it, `@types/jest`'s
      ambient globals (`describe`, `it`, `expect`, `jest`) silently weren't
      picked up even though nothing else restricts `compilerOptions.types`.

## Done (continued)

- [x] Empty-state CTA. Both the Today and Plans tabs' empty states now have
      a "+ Add a plan" button (`emptyStateCta`), in addition to the existing
      header "+ Add" — a first-time user with zero plans has an obvious next
      action right where the empty-state copy already points them.
- [x] Temperature/humidity surfaced on `WeatherBadge`. `getForecastForSlot`
      now returns optional `temperature`/`humidity` ranges (from
      `record.general` for 24hr, from the day record for 4-day; 2hr still
      omits them — NEA's nowcast API doesn't carry them). `WeatherBadge`
      renders the temp range next to the source label when present. The
      formatter (`formatTempRange`) lives in `src/utils/formatTempRange.ts`,
      not inline in the component — see the testing note below for why.
- [x] Network/API errors distinguished from "no forecast" in `WeatherBadge`.
      `getForecastForSlot`'s return type gained a `source: "error"` (fetch
      itself failed) distinct from `"unavailable"` (every tier responded
      successfully but had no matching entry). `WeatherBadge` shows
      "Couldn't load forecast" for the former, "No forecast" for the latter.
- [x] Slot reordering (drag-and-drop) — **Today tab only**. Plans tab groups
      slots into per-date `SectionList` sections; cross-section dragging
      (moving a slot from one day to another) isn't what `reorderSlots`
      does (it reorders within a single date) and wasn't attempted here —
      see "Not started" below. `SortableItineraryList` wraps each
      `ItineraryCard` with a drag handle (long-press + pan, via
      `react-native-gesture-handler`'s `Gesture.Pan()` + Reanimated's
      `LinearTransition` for the shift animation). It assumes roughly
      uniform row heights (true here since every field is single-line) and
      measures one row via `onLayout` to compute the drag-to-swap
      threshold — a real per-row height map would be needed if card content
      ever becomes multi-line/variable height. The pure swap logic is
      `moveItem` in `src/utils/reorder.ts` (tested); the gesture wiring
      itself isn't unit-tested (native gesture interaction, not
      meaningfully testable under `jest-expo` without a device/simulator).
- [x] "Use my location" in `SlotForm`. New `useCurrentLocation` hook
      (`src/hooks/useCurrentLocation.ts`) wraps
      `requestForegroundPermissionsAsync` → `getCurrentPositionAsync` →
      `reverseGeocodeAsync`, formatting the result the same shape SlotForm
      already expects from Google Places. Required adding the
      `expo-location` config plugin to `app.json` (without it,
      `NSLocationWhenInUseUsageDescription` never lands in Info.plist and
      the permission prompt silently fails on iOS).
- [x] Swipe-to-delete on `ItineraryCard`. Uses
      `react-native-gesture-handler/ReanimatedSwipeable` (the plain
      top-level `Swipeable` export is marked `@deprecated` in the installed
      v2.32 — its JSDoc says to use the Reanimated version instead).
      `ItineraryCard` now takes a required `onDelete` prop; both the Today
      and Plans screens wire it to the store's `deleteSlot(date, slotId)`
      (Plans' `SectionList` sections needed a `date` field added alongside
      `title`/`data` so `renderItem` can call it per-section).

## Done (continued, round 2)

- [x] Retry affordance on `source: "error"` in `WeatherBadge`. `useWeatherForSlot`'s
      react-query `refetch` is now threaded through `ItineraryCard` into
      `WeatherBadge` as `onRetry`; the badge renders "Couldn't load
      forecast · Retry" as a `Pressable` only when a retry handler is given
      (kept optional so the prop isn't forced on hypothetical future
      callers that can't refetch).
- [x] Duplicate/copy a plan to another day, **and** cross-day "reordering"
      (moving a slot to a different date) — implemented together as one
      feature rather than two, since both are "put this slot on a
      different date" and differ only in whether the original is deleted.
      Deliberately *not* drag-and-drop between `SectionList` sections (that
      was the original framing for cross-day reordering) — a date-picker +
      "Duplicate"/"Move" button pair is far less fragile than cross-section
      drag physics and just as fast to use. New `retargetSlotDate` util
      (`src/utils/retargetSlotDate.ts`, tested) rewrites an ISO timestamp
      onto a new calendar date while preserving local time-of-day, using
      `Date` setters rather than string slicing so it's correct regardless
      of device timezone. Wired into `plan/[id].tsx` via a new
      `CopyToDateAction` component, reusing the existing `addSlot`/`deleteSlot`
      store actions — no new store surface needed.
- [x] Auto-clean past plans → implemented as an Upcoming/Past split rather
      than silent deletion (silently destroying a user's past plans felt
      like the wrong default; the item's own note allowed for either).
      `splitPlansByDate` (`src/utils/splitPlansByDate.ts`, tested) partitions
      by lexical date-string comparison. The Plans tab now shows only
      upcoming sections by default, with a "Show N past plans" footer
      toggle (`ListFooterComponent`) that reveals them sorted most-recent-first.
- [x] Manual light/dark mode override. New `useSettingsStore`
      (`src/store/settingsStore.ts`, MMKV-persisted like the itinerary
      store) holds a `themePreference: "system" | "light" | "dark"`. Pure
      resolution logic lives in `resolveColorScheme` (tested); `useTheme`
      and a new `useAppColorScheme` (`src/hooks/useTheme.ts`) combine it
      with the device's `useColorScheme()`. Every component that previously
      called `useColorScheme()` directly (`WeatherBadge`, `ItineraryCard`,
      `SortableItineraryList`, `appTabs`, the Today screen, and the root
      `_layout.tsx`'s `ThemeProvider`) now goes through `useTheme()`/
      `useAppColorScheme()` instead — otherwise the override would apply
      inconsistently across the app. New `/settings` modal screen (linked
      from a gear icon in the Plans tab header) exposes the three-way
      choice. Extracted the itinerary store's MMKV `persist` storage
      adapter into `src/store/mmkvStorage.ts` so the new settings store
      doesn't duplicate it / open a second native MMKV instance.

## Not started

- [ ] Weather-aware notifications. `expo-location` is now a real dependency
      (not just installed-but-unused); a local notification ("bring an
      umbrella — rain forecast for your 3pm stop") the morning of or shortly
      before a slot starts would be very on-brand for an app called Brelly.
      Needs `expo-notifications` (not yet a dependency, and a bigger/riskier
      addition than anything else in this file — native permissions +
      scheduled/background delivery that can't be meaningfully verified
      without a device or simulator) and a background task or scheduled
      local notification tied to each slot's forecast. Left for a future
      pass deliberately rather than rushed.

## Notes for whoever (or whatever) continues this

- This repo has no component-rendering test setup (`@testing-library/react-native`
  isn't installed, and no precedent for rendering a component in a test
  exists here). `react-test-renderer` is present transitively via
  `jest-expo`, so it's technically possible, but be aware that importing
  *any* component that (transitively) imports `src/constants/theme.ts` pulls
  in `@/global.css`, which Jest cannot parse — it'll fail with
  `SyntaxError: Unexpected token ':'` pointing at the CSS file, not at your
  test. This is why `formatTempRange` and `formatReverseGeocodedAddress`
  live in `src/utils/`/`src/hooks/` as plain functions rather than being
  exported from `WeatherBadge.tsx` — keep new non-trivial logic
  extractable and test it there instead of trying to render the component.

- Same problem, different native module: anything that imports
  `src/store/itineraryStore.ts` or `src/store/settingsStore.ts` (even
  transitively) fails under Jest with `Invariant Violation:
  TurboModuleRegistry.getEnforcing(...): 'NitroModules' could not be
  found` — `react-native-mmkv` needs a native module that doesn't exist in
  the test environment. Verified by trial import; not worth mocking for
  what these stores contain. Same rule applies: keep new store-adjacent
  logic (reducers, date math, filtering/sorting) in plain `src/utils/`
  functions that operate on plain data and take the store's current state
  as a parameter — `moveItem`, `retargetSlotDate`, `splitPlansByDate`, and
  `resolveColorScheme` all follow this so they could be tested directly;
  the stores themselves just call them.

- Before trusting any NEA API type again, curl the live endpoint and diff
  against the TS type by hand — the original `weather.ts`/`types/weather.ts`
  had three separate shape mismatches that `tsc` had no way to catch, because
  the fetch responses were cast with `as`, not validated.
- `AGENTS.md` requires checking `docs.expo.dev/versions/v57.0.0/` before
  writing Expo/Router code — the NativeTabs + modal-Stack combination isn't
  obvious from file conventions alone.
