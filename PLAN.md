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

## Read this before writing code here

- **Components _can_ now be render-tested** — this reverses what this file
  said through round 5. `@testing-library/react-native` is installed and
  `jest.setup.js` + `__mocks__/` clear the three things that used to make it
  impossible: `@/global.css` (mapped to a stub, since Jest can't parse CSS and
  the SyntaxError points at the stylesheet rather than your test),
  `react-native-mmkv`'s Nitro TurboModule (an in-memory map), and
  expo-notifications / expo-location / expo-router. Screens are tested by
  seeding the store with `useItineraryStore.setState(...)` and asserting on
  what renders — see `src/app/(tabs)/index.test.tsx`.
- **Never put a test file under `src/app/`.** Expo Router's `require.context`
  regex (`expo-router/_ctx.ios.js`) matches *every* `.ts`/`.tsx` file beneath
  the app root — the only exclusions are `+api`, `+html` and `+middleware`. A
  `settings.test.tsx` there is therefore treated as a route, so Metro bundles
  it and everything it imports into the *app*, and the build dies on
  `Unable to resolve module console` — `@testing-library/react-native`'s logger
  requires Node builtins that don't exist in a React Native bundle. Tests for
  route components live in `src/test/screens/` and import the screen through
  its `@/app/...` alias. (Nothing warns about this: `tsc`, `yarn lint` and
  `yarn test` all pass, and only a real bundle fails. `npx expo export
  --platform ios` catches it.)
- **RNTL 14 is asynchronous.** `render`, `renderHook` and every `fireEvent`
  return promises and must be awaited, and the `screen` global is _not_
  populated — assert through the object `render` resolves to (that's what
  `src/test/renderWithProviders.tsx` returns). A missing `await` fails with
  "`render` function has not been called", which reads like a setup problem
  rather than a missing keyword.
- **Reanimated 4 needs a hand-written test double.** Its own `mock.js`
  re-imports the real entry point, which loads `react-native-worklets`, which
  builds `NativeWorklets` at module scope and throws "Cannot read properties of
  undefined (reading 'loadUnpackers')". `__mocks__/react-native-reanimated.js`
  stands in instead; because it sits next to `node_modules` it's picked up
  automatically, and adding a `jest.mock` factory that requires it makes the
  resolver recurse into itself.
- **Keep non-trivial logic in plain `src/utils/` functions anyway.** Rendering
  is now possible but still slower and noisier than testing a pure function,
  and decisions expressed as data are easier to enumerate. `moveItem`,
  `retargetSlotDate`, `splitPlansByDate`, `resolveColorScheme`,
  `shouldNotifyForRain`, `computeNotificationTriggerTime`, `formatTempRange`,
  `formatPeriodLabel`, `formatReverseGeocodedAddress`,
  `shouldStackDateTimeFields`, `planNotificationResync`, `buildDigestMessage`,
  `isWithinQuietHours` and the `planSelectors` all exist as separate functions
  for this reason; the components and stores just call them.
- **Don't put lookups on a zustand store.** A store method that returns a fresh
  object can't be selected: `useItineraryStore((s) => s.findSlotById(id))`
  re-runs every render, returns a new reference each time, and
  `useSyncExternalStore` reads that as a perpetual state change — "Maximum
  update depth exceeded" on opening a plan. The mirror-image trap is selecting
  something _too_ stable: `useItineraryStore((s) => s.getTodaysPlan)` selects a
  function whose identity never changes, so the screen never re-renders when
  plans do. Select `state.plans` and call a pure function from
  `@/utils/planSelectors` on it.
- **`toISOString().split("T")[0]` is not a local date key.** It formats in UTC,
  so in Singapore (UTC+8) every time between midnight and 08:00 resolves to
  _yesterday_ — "Today" would show the wrong day for a third of each day. Use
  `toDateKey`/`todayKey` from `@/utils/dateKeys`.
- **Don't trust an NEA API type — curl the endpoint and diff it by hand.** The
  original `weather.ts`/`types/weather.ts` had three separate shape mismatches
  that `tsc` couldn't catch, because responses were cast with `as` rather than
  validated (forecast strings are nested `{code, text}` objects, not bare
  strings; 2hr uses `forecasts[].area`, not `areas[].name`; 4-day dates live in
  `timestamp`, not `date`).
- **`AGENTS.md` requires checking `docs.expo.dev/versions/v57.0.0/` before
  writing Expo/Router code.** Things that were not guessable from file
  conventions: the NativeTabs + modal-`Stack` combination, and the header
  bar-button API (see the `Stack.Toolbar` note below).
- **Jest is pinned to `^29.7.0` on purpose.** `jest-expo@57` depends on
  internals (`jest-mock`'s `clearMocksOnScope`) that don't exist in Jest 30;
  upgrading breaks test-suite loading with an opaque `TypeError`. `tsconfig`
  also needs its explicit `"types": ["jest"]` — without it `@types/jest`'s
  ambient globals silently aren't picked up.
- **Native modules need their config plugin in `app.json`.** `expo-location`
  without its plugin means `NSLocationWhenInUseUsageDescription` never reaches
  Info.plist and the iOS permission prompt silently fails.

## Built so far

- **Weather.** NEA service with 2hr nowcast / 24hr / 4-day tier selection
  (`getForecastForSlot`), nearest-NEA-area matching by coordinates against the
  live `area_metadata` lat/lng, temperature/humidity ranges where the tier
  carries them, and a `source: "error"` (fetch failed) distinct from
  `"unavailable"` (responded, no matching entry) so `WeatherBadge` can show
  "Couldn't load forecast · Retry" instead of "No forecast".
  `getUpcomingForecast` powers the empty-state "weather nearby" preview.
- **Plans.** Google Places autocomplete + details (session-token billing),
  Google reverse geocoding for "Use my location" (`reverseGeocode`, with the
  on-device geocoder kept as an offline fallback — Apple's Singapore placemarks
  are frequently no more specific than "Singapore"),
  Zustand + MMKV store, `SlotForm` shared by the add/edit screens, swipe to
  delete, drag to reorder within a day (`SortableItineraryList`), and
  duplicate to another date via `CopyToDateAction` + `retargetSlotDate` —
  deliberately a date picker rather than cross-section drag physics. A slot is
  filed under the day its `startTime` falls on, and `updateSlot` re-files it
  when an edit changes that day, so moving a plan is just editing its date.
- **Routing.** `(tabs)` group (Today, Plans) + root `Stack` with `plan/new`,
  `plan/[id]` and `settings` as modals.
- **Notifications.** Rain alerts scheduled 45min ahead via
  `useRainNotificationScheduler`; `cancelAndDeleteSlot` cancels the pending
  notification at every delete site so it can't fire for a deleted plan.
- **Appearance.** Pastel lavender/plum palette (`Colors`, plus a `danger`
  token so destructive actions theme with everything else), SF Symbols /
  Material Symbols via a shared `Icon` component, a `HeaderHeight` constant so
  the Today/Plans headers don't shift on tab switch, and a manual
  light/dark/system override in `settings` (`useSettingsStore`, read through
  `useTheme`/`useAppColorScheme` — never `useColorScheme()` directly, or the
  override applies inconsistently).
- **Past plans** are split out of the Plans list behind a "Show N past plans"
  toggle rather than auto-deleted — silently destroying a user's history was
  the wrong default.

### Bug fixes (round 5)

Reported against the "Add plan" modal; each is worth knowing about because the
cause wasn't in our code.

- **"Use my location" named the wrong street.**
  `getCurrentPositionAsync({})` defaults to `Accuracy.Balanced` — "within one
  hundred meters" per the SDK 57 docs, which in Singapore resolves onto a
  neighbouring street that the reverse geocode then faithfully names. Now
  `Accuracy.Highest`. Separately, `formatReverseGeocodedAddress` joined
  `name`/`street`/`city` blindly and could render a bare street number as an
  address ("20, Singapore"); it now composes
  "<place name>, <street number> <street>, <city> <postal code>", dropping a
  `name` that only repeats the street line (iOS commonly sets `name` to the
  whole street address) and using `district`/`subregion`/`region` as locality
  fallbacks.
- **Starts/Ends pickers overlapped.** The native `DateTimePicker` renders at
  its own intrinsic width and does _not_ shrink to a `flex: 1` container, so
  two side by side drew over each other on a phone. `SlotForm` now stacks them
  when the form is too narrow, decided by `shouldStackDateTimeFields` against
  `useWindowDimensions()` (not `onLayout` — that would flash the broken layout
  on the first frame).
- **Header "Cancel" rendered as a capsule.** iOS 26 wraps anything returned
  from `headerRight` in a Liquid Glass background, and there's no opt-out on
  that prop — `hidesSharedBackground` only exists on the native
  bar-button-item API, reached via `Stack.Toolbar`. `HeaderDismissButton`
  uses `Stack.Toolbar` on iOS only: it's a no-op on web, and on Android
  `Stack.Toolbar.Button` renders only its icon (text children are dropped), so
  a text-only button would vanish there.

### Round 6 — deeper weather + smarter notifications

Everything under "Deeper weather" and "Smarter notifications" below, plus one
reported crash.

- **The "Maximum update depth exceeded" crash on opening a plan** was the
  `findSlotById` store selector returning a new object each render (see the
  zustand note above). Lookups moved to `@/utils/planSelectors` as pure
  functions; the same change fixed a latent bug where the Today screen
  subscribed to a getter and so never re-rendered when plans changed.
- **Weather depth.** `SlotForecast` now carries `wind` and `updatedAt`, both of
  which the API already returned and the app discarded; `WeatherBadge` shows
  wind and "Updated 12m ago". New `liveConditions` service reads the real-time
  rainfall / air-temperature / relative-humidity / wind-speed station feeds
  (nearest *reporting* station — the station list includes sensors absent from
  the readings batch, and the nearest one is often one of them), and
  `airQuality` reads PSI and UV. `LiveConditionsCard` shows them anchored to
  the stop the user is at or heading to, so no new location permission is
  needed. Forecasts are cached to MMKV and served as `source: "cached"` when a
  request fails, labelled with their age.
- **Notification upkeep.** `runNotificationSync` re-checks every upcoming slot's
  forecast on launch and on foreground, scheduling alerts for rain that
  appeared and cancelling for rain that cleared — previously an alert was
  scheduled once at creation time, possibly against a 4-day outlook, and fired
  regardless of what the weather did afterwards. A failed forecast fetch is
  explicitly *not* read as "no rain", so a network blip can't silently strip an
  alert. Quiet hours suppress rather than delay (a delayed umbrella warning
  arrives after the slot started), and the daily digest is a one-shot DATE
  trigger re-created each foreground, because a repeating DAILY trigger would
  replay whichever day's plans were current when it was set up.
- **Testing.** Components and hooks are now render-tested — see the notes
  above. 337 tests across 38 suites.

## Not started

- [ ] Notification **lead time** control. The opt-out half of this shipped in
      round 6 — Settings has a rain-alerts switch, quiet hours and a per-stop
      mute, and `scheduleRainNotification` already takes a `leadMinutes`
      option. What's missing is UI for it: the 45-minute default in
      `computeNotificationTriggerTime` is still the only value anyone gets.
- [ ] Dedicated notification icon/color. `app.json`'s `expo-notifications`
      plugin config is minimal (no `icon`/`color`) because no notification icon
      asset exists in `assets/images/`, so Android shows the default.
- [ ] Recurring plans / plan templates — "repeat every weekday" rather than
      duplicating one day at a time.
- [ ] Search/filter plans over `label`/`location` (or by NEA region), for once
      the list grows past a handful.
- [ ] Calendar export/share, e.g. to the device calendar via `expo-calendar`.
- [ ] Calendar import e.g. from device calendar
- [ ] Widget / lock-screen glance of the next slot's weather.

## Feature ideas (round 6)

Candidates derived from what's already built — each one names the seam it hangs
off, because the point of the list is that none of them need new architecture.
Not prioritised against each other; pick per round.

### Deeper weather (data we already fetch and throw away)

- [x] **Wind + freshness on the slot card.** `TwentyFourHrForecast.general.wind`
      and `updatedTimestamp` are parsed into our types and then never read —
      `SlotForecast` only carries `forecast`/`temperature`/`humidity`. Widening
      it to include wind and the source timestamp lets `WeatherBadge` show
      "Updated 12 min ago" instead of implying the number is live, which matters
      most for the 4-day tier where it can be many hours old.
- [x] **Live station readings, not just forecasts.** `data.gov.sg` exposes
      real-time `rainfall`, `air-temperature`, `relative-humidity` and
      `wind-speed` station feeds in the same `/v2/real-time/api` namespace as
      the three we already call. `findNearestArea` is a generic nearest-by-
      lat/lng match, so it works unchanged against station metadata — that's the
      whole implementation of "is it actually raining at my next stop right
      now", which a 2hr nowcast can't answer.
- [x] **PSI (haze) and UV index.** Both are the same NEA API shape and both
      change the answer to "should I be outdoors" in Singapore in a way rain
      doesn't. Pairs with a `shouldNotifyForHaze` / `shouldNotifyForUv` sibling
      to `shouldNotifyForRain`, same keyword-free numeric-threshold pattern, and
      the same trivially testable pure-function shape.
- [x] **Offline / last-known forecast.** A failed fetch currently produces
      `source: "error"` and shows "Couldn't load forecast · Retry" with nothing
      behind it. React Query is already the transport (`useWeatherForSlot`), so
      persisting its cache and falling back to the last successful reading —
      labelled with its age — is a cache-layer change, not a service rewrite.
- [x] **Pull-to-refresh on Today/Plans.** `useWeatherForSlot` has a 10-minute
      `staleTime` and only refetches on window focus; there's no user-initiated
      refresh anywhere in the app.

### Smarter notifications

- [x] **Re-check before firing.** `useRainNotificationScheduler` schedules once,
      at slot-creation time, off a forecast that may be up to four days out —
      the 45-minute alert then fires even if the forecast has since cleared.
      Rescheduling on app foreground (or via a background task) against a fresh
      `getForecastForSlot`, reusing the existing `notificationId` cancel path,
      makes the alert reflect the current forecast rather than a stale one.
- [x] **Morning digest.** One notification at a user-set time listing today's
      slots and whether to bring an umbrella, instead of N per-slot alerts. All
      the data comes from `getTodaysPlan` + `getForecastForSlot`.
- [x] **Quiet hours / per-slot mute.** Follows the same `useSettingsStore`
      pattern as the lead-time control already listed above.

### Itinerary intelligence

- [ ] **Indoor/outdoor tag per slot.** A `kind: "indoor" | "outdoor"` field on
      `ItinerarySlot` is the cheapest large gain in notification signal-to-noise
      — rain doesn't matter for a slot inside a mall. Could default by Google
      Places type rather than asking. Note this is the first field addition that
      hits already-persisted data (see store versioning below).
- [ ] **Gap and overlap warnings.** Every slot stores `latitude`/`longitude`,
      `startTime` and `endTime`, so a pure `detectScheduleConflicts(slots)` —
      overlapping times, or a straight-line distance that isn't plausible in the
      gap between them — is exactly the plain-data-in/plain-data-out util shape
      this repo can actually test.
- [ ] **"Move it later" suggestion.** `getUpcomingForecast` already returns the
      24hr forecast's periods; when a slot's period is wet and an adjacent one
      isn't, offering the dry window turns the app from reporting to advising.
      Reuses `retargetSlotDate`'s existing edit path.
- [ ] **Now / next highlighting on Today.** The Today list renders every slot
      identically regardless of the clock; a `findCurrentAndNextSlot(slots, now)`
      util plus card emphasis makes the screen answer "where am I supposed to be"
      at a glance.
- [ ] **Notes and an auto-seeded packing list per slot** (umbrella, sunscreen),
      derived from the same forecast text `shouldNotifyForRain` already reads.
- [ ] **Week view on Plans.** The 4-day outlook is island-wide and already
      fetched — a date strip showing each upcoming day's forecast alongside its
      plan count is mostly presentation over `splitPlansByDate`.

### Data lifecycle

- [ ] **Store schema versioning.** Neither `persist` config passes `version` or
      `migrate`. Every idea above that adds a field to `ItinerarySlot` (`kind`,
      notes, per-slot mute) lands on existing installs' stored JSON, so this
      should go in *before* the first of them, not after.
- [ ] **Undo delete.** Deletes are immediate and permanent. `cancelAndDeleteSlot`
      is already the single choke point for every delete site, so an undo buffer
      has exactly one seam to thread through — including re-scheduling the
      notification it cancelled.
- [ ] **Export/import a JSON backup.** MMKV is device-local with no backup path;
      losing the app loses the history that the "Show N past plans" decision
      deliberately preserved.

### Polish / platform

- [ ] **Onboarding permission priming.** Location and notification prompts fire
      cold, mid-task, with no explanation of what they buy — and a denied
      notification prompt silently disables the app's main feature.
- [ ] **Accessibility pass.** Swipe-to-delete and drag-to-reorder in
      `SortableItineraryList` are gesture-only with no accessibility actions, and
      no screen has been checked against Dynamic Type.
- [ ] **Haptics** on reorder commit and delete, to confirm gestures that
      currently have no non-visual feedback.
