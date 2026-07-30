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

## Not started

- [ ] Add CTA in empty state. Worth implementing a button for users to easily
      plans when they have none
- [ ] Surface temperature/humidity. `TwentyFourHrForecast` and
      `FourDayForecast` carry temp/humidity ranges already; 2hr nowcasts
      don't. Worth showing on `WeatherBadge` or a slot detail view when
      available.
- [ ] Reordering slots. `reorderSlots` exists on the store but has no UI
      (drag-and-drop) — `react-native-gesture-handler` is already a
      dependency and unused for this.
- [ ] "Use my location" in `SlotForm`. `expo-location` is installed but
      never imported — could prefill or bias the place search.
- [ ] Distinguish network/API errors from "no forecast" in `WeatherBadge`.
      Right now a fetch failure and a genuinely missing forecast render
      identically ("No forecast").
- [ ] Swipe-to-delete on `ItineraryCard` as an alternative to opening the
      edit modal just to delete.

## Notes for whoever (or whatever) continues this

- Before trusting any NEA API type again, curl the live endpoint and diff
  against the TS type by hand — the original `weather.ts`/`types/weather.ts`
  had three separate shape mismatches that `tsc` had no way to catch, because
  the fetch responses were cast with `as`, not validated.
- `AGENTS.md` requires checking `docs.expo.dev/versions/v57.0.0/` before
  writing Expo/Router code — the NativeTabs + modal-Stack combination isn't
  obvious from file conventions alone.
