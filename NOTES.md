# Brelly engineering notes

Context for implementing in this repo: the constraints that aren't guessable from
the code, and what has already been built. `PLAN.md` holds only the open tasks and
links back here.

- [Read this before writing code here](#read-this-before-writing-code-here) — the
  traps. Read before touching tests, the store, weather parsing or Expo config.
- [Built so far](#built-so-far) — feature-by-feature summary of the app as it stands.
- [Round history](#round-history) — why things are the way they are, per round.
- [Shipped from the feature-idea list](#shipped-from-the-feature-idea-list) — ideas
  that were built, with how they differed from the original sketch.

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
  and decisions expressed as data are easier to enumerate. `sortSlotsByStart`,
  `saveWithFeedback`, `retargetSlotDate`, `splitPlansByTime`, `formatPlanDate`,
  `resolveColorScheme`,
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
  bar-button API (see the `Stack.Toolbar` note in
  [round 5](#bug-fixes-round-5)).
- **Jest is pinned to `^29.7.0` on purpose.** `jest-expo@57` depends on
  internals (`jest-mock`'s `clearMocksOnScope`) that don't exist in Jest 30;
  upgrading breaks test-suite loading with an opaque `TypeError`. `tsconfig`
  also needs its explicit `"types": ["jest"]` — without it `@types/jest`'s
  ambient globals silently aren't picked up.
- **Native modules need their config plugin in `app.json`.** `expo-location`
  without its plugin means `NSLocationWhenInUseUsageDescription` never reaches
  Info.plist and the iOS permission prompt silently fails. `expo-calendar` and
  `expo-notifications` now carry theirs too — the latter's `icon`/`color`, or
  Android falls back to a generic bell.
- **`yarn add`ing a native package without running `expo install --check`
  crashes the app at launch, not at build time.** `expo`/`expo-modules-core`
  and every `expo-*` package have to be on versions that agree with each
  other's precompiled binaries — a stray direct `expo-file-system` bump left
  `expo` itself two patch versions behind, so `ExpoFileSystem.framework`
  referenced a Swift symbol `ExpoModulesCore.framework` didn't export yet.
  `tsc`, `yarn lint`, `yarn test` and even `npx expo export` all stay green;
  the only symptom is a `dyld: Symbol not found` crash report in
  `~/Library/Logs/DiagnosticReports/`. Run `npx expo install --fix` after
  touching any `expo-*`/native dependency, then `cd ios && rm -rf Pods
  Podfile.lock build && npx pod-install` — a plain `pod install` on top of the
  old lock can leave stale precompiled xcframeworks in place. After that,
  restart Metro with `--clear`: Reanimated/Worklets bumps throw "[Worklets]
  Mismatch between JavaScript code version and Worklets Babel plugin version"
  from a cached transform that still embeds the old plugin version otherwise.
- **A native picker's props are invisible when the mock drops them.** The
  `DateTimePicker` stub in `jest.setup.js` forwards `themeVariant`, `mode`,
  `value` and `onValueChange` on purpose: each was, at some point, the only
  thing a test could check. `themeVariant` is what keeps the picker in the
  app's theme rather than the device's, and `mode` is the only way to tell the
  Day picker apart from Starts and Ends. Adding a prop the mock swallows means
  the test passes and the app is wrong.
- **`useNavigation` is mocked, and something depends on it.**
  `useUnsavedChangesGuard` disables a modal's swipe-to-dismiss through
  `setOptions({ gestureEnabled })`, which is the *only* trace it leaves —
  there's no rendered output to assert on. The shared navigation object in the
  `expo-router` mock exists for that.

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
  delete, and duplicate to another date via `CopyToDateAction` +
  `retargetSlotDate` — deliberately a date picker rather than cross-section
  drag physics. A slot is filed under the day its `startTime` falls on, and
  `updateSlot` re-files it when an edit changes that day, so moving a plan is
  just editing its date. Slots are always ordered by start time
  (`sortSlotsByStart`); there is no manual order and no `reorderSlots` — see
  [round 7](#round-7--one-order-and-feedback-on-every-save). The form asks for
  the location first and prefills the label from it,
  shows a picked place as a confirmed chip, and takes one date plus two times
  (`slotTimeFields`) rather than two `mode="datetime"` pickers.
  Both lists and the archive can be searched (`filterPlans`), and deletes are
  undoable from the toast (`useDeleteSlotWithUndo`).
- **Routines.** A repeat is stored as a rule (`Routine`, `routineStore`) —
  any set of weekdays plus an optional end date — and materialised into
  ordinary slots a fortnight ahead (`planRoutineMaterialization`,
  `RoutineHorizonDays`), topped up on launch and on foreground by
  `useRoutineSync`. Every stop carries the `routineId` that made it, so editing
  or deleting one day asks whether it means the day or the rule
  (`askEditScope`); "this day only" detaches the slot and records an exception,
  which is what stops the next top-up refilling it. Nothing downstream knows
  routines exist. A dedicated routines screen (`src/app/routines.tsx`, modal
  route) lists all rules with `describeRoutine` and exception counts.
- **Routing.** `(tabs)` group (Today, Plans, History) + root `Stack` with
  `plan/new`, `plan/[id]`, `settings` and `routines` as modals.
- **Notifications.** Rain alerts scheduled a user-set lead time ahead
  (`rainLeadMinutes`, default 45) via `useRainNotificationScheduler`;
  `cancelAndDeleteSlot` cancels the pending notification at every delete site
  so it can't fire for a deleted plan. Settings surfaces the OS permission
  state, how many alerts are actually queued, and a test alert — see
  [round 9](#round-9--the-backlog-minus-the-one-thing-that-needs-xcode).
- **Appearance.** Pastel lavender/plum palette (`Colors`, plus a `danger`
  token so destructive actions theme with everything else), SF Symbols /
  Material Symbols via a shared `Icon` component, a `HeaderHeight` constant so
  the Today/Plans/History headers don't shift on tab switch, and a manual
  light/dark/system override in `settings` (`useSettingsStore`, read through
  `useTheme`/`useAppColorScheme` — never `useColorScheme()` directly, or the
  override applies inconsistently).
- **Past plans** are split out of the Plans list rather than auto-deleted —
  silently destroying a user's history was the wrong default. They live on
  their own **History** tab (`src/app/(tabs)/history.tsx`), alongside Today
  and Plans in the bottom nav. Archive pruning ("clear before this date") is
  available there.
- **Itinerary intelligence.** Gap/overlap warnings (`detectScheduleConflicts`)
  on the Plans screen, dry-window suggestion (`suggestDryWindow`) on the edit
  screen, notes field per slot, and an auto-seeded packing list
  (`derivePackingList`) derived from the forecast text. A `WeekStrip` on Plans
  shows the next 7 days with stop counts.
- **Onboarding.** A two-step permission primer (location then notification) on
  the Today screen for new users, gated by `hasSeenOnboarding` in the settings
  store.
- **Backup.** Export/import of itinerary + routine store state as a JSON file
  via expo-file-system v57's `File` class.
- **Haptics.** `expo-haptics` fires on delete and on save success/failure.
- **Store versioning.** All three persist configs carry `version` and `migrate`.

## Round history

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

Everything under "Deeper weather" and "Smarter notifications" in
[shipped feature ideas](#shipped-from-the-feature-idea-list), plus one reported
crash.

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

### Round 7 — one order, and feedback on every save

Two reported problems, both about the app not telling the truth about itself.

- **Drag-to-reorder is gone.** Today let you drag rows into any order while
  Plans rendered the same slots by start time, so the same day read two
  different ways and nothing reconciled them. Reordering an itinerary was the
  wrong affordance to begin with: a day's order is a fact about the clock, not
  a preference. `sortSlotsByStart` in
  [planSelectors.ts](src/utils/planSelectors.ts) is now the only ordering, and
  it runs *at render on both tabs* as well as on write — installs that predate
  this still have a hand-dragged order persisted in MMKV, and sorting only on
  write would leave it there forever. `SortableItineraryList`, `utils/reorder`
  and the store's `reorderSlots` were deleted; Today maps `ItineraryCard`
  directly. This also closed two accessibility items for free — the drag
  handle had no `accessibilityActions`, so a screen reader could not reorder
  at all.
- **Every mutation now reports success or failure**, via `saveWithFeedback` +
  `ToastHost`. Three things about this are worth knowing before touching it:
  - **The failure branch is real, not decorative.** Both stores are wrapped in
    zustand's `persist`, which calls `mmkvStorage.setItem` *synchronously*
    from inside `set(...)` and does not catch — so a failed write throws out
    of the action itself. Before this it took the screen down; now it raises
    an error toast. Conversely, on the success path the change is already on
    disk by the time the toast appears, so the confirmation isn't a guess.
  - **A failed save must not navigate away.** `saveWithFeedback` returns the
    action's value (`addSlot` returns the new slot) or the error, and the add
    and edit forms `return` early rather than calling `router.back()` —
    dismissing on failure would look like it worked and drop everything the
    user typed.
  - **Modals need their own toast host.** `plan/new`, `plan/[id]` and
    `settings` are `presentation: "modal"`, which on iOS is a real view
    controller presented over the window, so a host at the root is *behind*
    them — a Settings toast would never be seen. Each modal mounts a
    `<ToastHost />` and the root mounts `<ToastHost root />`, which draws only
    while `modalHosts` is empty. That's a flag rather than "last host to
    register wins" on purpose: cold-starting into a modal mounts both in one
    commit and the modal's effect runs first. Because the toast lives in the
    store and not in the host, one raised just before `router.back()` survives
    the modal that raised it and finishes on the tab underneath.

### Round 8 — a stop leaves the list when it's over

The lists showed everything ever planned, forever. A stop that finished at 11am
held the top of Today until midnight, and past days were reachable only through
a "Show N past plans" toggle at the very *bottom* of the Plans list — so a month
of upcoming plans stood between you and it.

- **Finished stops move to their own screen.** [past.tsx](src/app/past.tsx) is
  a pushed route (not a modal like `plan/new`, `plan/[id]` and `settings` — it
  is somewhere you browse and come back from), reached from an archive button
  in the Plans header that appears only once there is something in it. Nothing
  is deleted; both tabs are now "what's ahead" and the archive is "what
  happened".
- **The cut is per stop, on end time.** `splitPlansByDate` cut on the date key,
  which is why a morning stop stayed "upcoming" all day.
  [splitPlansByTime](src/utils/splitPlansByTime.ts) replaces it and lets today
  appear in *both* halves — morning in the archive, evening still ahead. All
  three screens read the two halves of one call, so a stop is in exactly one
  place and the boundary cannot drift between them. `splitPlansByDate` and its
  test are gone.
- **Two empty states became four.** A day whose stops have all finished is not
  an empty day, and saying "No plans yet" to someone who planned six things
  reads as data loss. Today says "Nothing left today" and points at the
  archive; Plans says "Nothing upcoming" rather than "Nothing planned" when
  everything has simply passed.
- **A past card asks for no forecast.** `ItineraryCard` takes a `past` prop
  that drops the weather query (`useWeatherForSlot` gained an `enabled`
  option), the badge, the pill and the accent bar. NEA publishes forecasts, not
  history, so every archived card would otherwise fire a request to render "No
  forecast". It does *not* dim the card — everything on that screen is past, so
  dimming distinguishes it from nothing and only costs contrast.
- **Day headings are a tested util now.** `formatSectionDate` was private to
  the Plans screen and read the clock internally;
  [formatPlanDate](src/utils/formatPlanDate.ts) takes today as an argument, so
  the wording is testable without freezing time, and it knows "Yesterday" —
  which the archive needs and the old one had no reason to.
- **Both screen test suites had to stop pinning fixtures to a fixed hour.** A
  slot at 07:00 is upcoming before breakfast and archived after it, so those
  fixtures are positioned relative to `now` now. This was latent before the
  change and invisible: nothing read a slot's end time.

### Round 9 — the backlog, minus the one thing that needs Xcode

Everything that was under "Not started" is done except the widget, plus the
open items from `UX.md` listed at the end of this section. See `UX.md` for the
per-item status; what follows is what a future round needs to *know*.

- **A stop leads with how soon it is.** `describeSlotTiming` puts "in 40 min" /
  "Now" ahead of the clock times, and falls back to the times alone past a
  12-hour horizon — "in 14 hr" is not something anyone plans against. Nothing
  ticks: the countdown is recomputed on render, which covers every way back
  onto the screen, and a per-card timer would wake the whole list once a minute
  to move a number no one is watching. The Today screen also outlines the
  current-or-next card, using the same `findCurrentOrNextSlot` the live
  readings are already anchored to, so the outlined card and the "Right now"
  figures always name one place.
- **Deletes are undoable, and the confirm dialog is gone.**
  `useDeleteSlotWithUndo` is the single seam — swipe on all three lists and the
  button on the edit screen. `Toast` gained an optional action, and a toast
  carrying one lives ~6s instead of ~3.2s. Two things are load-bearing:
  `restoreSlot` keeps the slot's **id** (`addSlot` mints a new one, which would
  make undo produce a lookalike), and it clears `notificationId` /
  `notificationLeadMinutes`, because the delete already cancelled that alert —
  carrying the id back would leave the slot looking permanently scheduled to
  the resync, and no alert would ever fire again.
- **The add/edit form was rebuilt around three fixes.** Location comes first
  and prefills the label (`placeNameOf`); a resolved place renders as a
  confirmed chip rather than as text that looks typed; and one **date** picker
  now drives two **time** pickers (`slotTimeFields`) instead of two
  `mode="datetime"` pickers that each held their own copy of the day. An end
  time before the start is read as running past midnight rather than rejected —
  a picker that only offers times gives the user no move to satisfy that error.
- **Repeats are materialised, not stored as a rule** (`expandRecurrence`). Every
  part of this app works over concrete slots — the time split, the resync, the
  archive, search — so a rule would have to be re-expanded at each of them, and
  the archive has no answer for one at all: a rule describes a future, not a
  history. The cost is that changing a series means editing each stop, which is
  why the counts are bounded (7 daily / 5 weekdays / 4 weekly) and the form
  states the count before the button is pressed.
  **Superseded in round 12** — see below. The half of that argument about
  concrete slots survived; the half about not storing a rule did not.
- **Calendar sync is two one-shot copies, not a sync.** A real sync needs a
  shared identity per event and a rule for when both sides changed; "I pressed
  the button" needs neither. Import has one problem worth knowing: a calendar
  event carries free-text location and no coordinates, and a slot is useless
  without them — so `resolveEventLocation` runs the text through the same
  Places lookup the form uses, and events it can't resolve are *reported*
  rather than imported without a forecast. All-day events are skipped for the
  same reason (no start time to pick a forecast tier from).
- **Settings can now be checked rather than trusted.**
  `useNotificationPermission` distinguishes "not asked" from "asked and
  refused" via `canAskAgain` — the second needs a trip to system settings, and
  offering a button that silently does nothing was the original bug.
  `countScheduledNotifications` shows what the OS actually has queued, which
  routinely differs from what the switches say, and `sendTestNotification`
  fires 5s out rather than immediately (a foreground notification may present
  no banner at all, so an alert that works would look broken).
- **`border` finally has a real value in both themes.** Light was still an
  alias for `backgroundSelected` — 1.19:1 on a card, the same invisible-divider
  problem dark already fixed. `#BBB4CF` is 1.64:1 on `backgroundElement`,
  matching dark's 1.61:1, so a divider reads the same weight either side.
- **Testing.** 684 tests across 62 suites. Two mock changes were needed: the
  `DateTimePicker` stub now forwards `mode` and `onValueChange` (there is no
  other way to check that changing the day carries both times along), and the
  `expo-router` mock gained `useNavigation`, because the unsaved-changes guard
  turns the modal's swipe-to-dismiss off through `setOptions({ gestureEnabled })`
  and that is the only trace it leaves.

### Round 10 — the location field stops moving the form

- **The place suggestions are a dropdown.** They used to render as a block
  between the Location and Label inputs, so the list growing and shrinking as
  you typed moved every field below it — Label, Day, Starts, Ends — mid-aim.
  The list is now absolute-positioned against the input and overlays what
  follows it. Four things are load-bearing. `zIndex` on the **Location field**,
  because the Label field below it is a later sibling and later siblings paint
  on top. `zIndex` on the **input's own wrapper**, because "Use my location" is
  a later sibling *within* the field and did exactly the same thing one level
  down — its text rendered over the first suggestion. `elevation` for Android,
  where it is the stacking order as well as the shadow. And
  `keyboardShouldPersistTaps="handled"` on the form's `ScrollView`, already
  there, which is why tapping a row doesn't blur the input and close the list
  out from under the tap. Focus gates the dropdown, and `handleLocationChange`
  sets the focus flag itself rather than trusting `onFocus` to have arrived
  first.
- **The reserved status line is gone, and "Searching…" moved into the row that
  was already there.** The line existed so messages coming and going wouldn't
  shift the form — but it charged every form 16pt of blank, permanently, for a
  message most never show. "Searching…" now shares the "Use my location" row,
  which renders either way, so the frequent case shifts nothing and costs no
  height; errors render only when real. With the row itself down from 32pt to
  24 (the `hitSlop` carries the 44pt target), Location and Label sit the same
  distance apart as every other pair of fields.
- **Testing.** 689 tests across 62 suites. Both stacking fixes are asserted
  from flattened styles — they are invisible to any test that only checks what
  rendered, since the wrong paint order still renders everything.

### Round 11 — a stop says whether it's under a roof

The per-stop "Rain alerts" switch already carried this idea in its own comment —
*"Rain matters for a park and not for a mall"* — but only as a preference someone
had to set by hand each time, on a switch whose reason was recorded nowhere. The
tag stores the fact; the switch stays the preference.

- **`kind` seeds the mute rather than becoming a second one.**
  [slotKind.ts](src/utils/slotKind.ts) holds the pair and the labels; nothing in
  `planNotificationResync`, `scheduleRainNotification`, `buildDigestMessage` or
  `useRainNotificationScheduler` changed. Two flags that both mean "don't warn
  me" is two places for the answer to differ, and the one the user can see is
  the switch. So the chip writes to it and lets go.
- **The coupling is symmetric, and lives in the press handler only.** Pressing
  Indoor switches this stop's alerts off; pressing Outdoor switches them back
  on; pressing the chip that's already selected does nothing. Two things about
  this are load-bearing. If only Indoor moved the switch, correcting a mis-tap
  would leave alerts silently off — and a warning that never arrives says
  nothing about why it didn't, which is the worse of the two ways to be wrong.
  And because the coupling is on the *press* and not in an effect, reopening an
  indoor stop whose alerts were deliberately re-enabled doesn't re-apply the
  default and quietly undo the choice on the next save. That is the one bug here
  that nothing on screen would have revealed, so it has its own test.
- **Absent means outdoor, and it is read through a function.**
  `resolveSlotKind` exists because the card, the form and the search index all
  have to agree about what an untagged slot is, and three copies of `?? "outdoor"`
  is three chances to disagree. Search indexes the *resolved* kind for exactly
  that reason — indexing the stored one would make "outdoor" quietly mean
  "tagged outdoor" and hide every plan predating the field.
- **Only indoor is marked on the card.** Outdoor is the default and most of the
  list, so a glyph on every row carries no information and costs the label the
  width — the same argument `VerdictPill` makes for leaving a clear stop
  untinted. The verdict pill, accent bar and badge are untouched either way:
  being indoors doesn't get you there.
- **Two call sites build a slot field by field and would have dropped it
  silently** — `handleDuplicate` and `initialValues`, both in
  [plan/\[id\].tsx](src/app/plan/%5Bid%5D.tsx). Everything else spreads
  `...values` or round-trips the whole slot, so it came through free. The
  calendar import is left untagged on purpose: an event carries no
  indoor/outdoor signal, and guessing one is worse than the default.
- **Testing.** 711 tests across 63 suites.

### Round 12 — a repeat becomes a routine

The old repeat wrote five stops for "Weekdays" and then stopped being anything.
There was no rule left to edit, extend or turn off, so a commitment that renews
every week had to be re-entered every week — and the five stops were
indistinguishable from five typed by hand.

- **Half of round 9's argument survived, and it is the half that mattered.**
  Every part of this app works over concrete slots, so it still does: the rule
  decides *which slots exist* and nothing else changed.
  `splitPlansByTime`, `planNotificationResync`, `filterPlans` and the archive
  were not touched and know nothing about routines. What was wrong was the leap
  from "downstream needs concrete slots" to "there must be no rule at all" —
  those are answered by a materialiser, not by throwing the rule away. The
  archive objection ("a rule describes a future, not a history") is handled by
  one line in `planRoutineMaterialization`: nothing before today is ever
  touched.
- **The horizon rolls, which is what a bounded count could never do.** Fourteen
  days ahead, topped up on launch and on foreground (`useRoutineSync`), so a
  routine never runs out. `RoutineHorizonDays` is a display decision, not a
  correctness one — the rule is complete regardless of how much of it has been
  written down.
- **`routineId` on a slot is the whole coupling**, and it is optional, so
  nothing predating routines needs a migration. It also carries the "this day
  only" answer: detaching clears it, and after that the stop is as ordinary as a
  hand-made one and nothing may sweep or rewrite it. Which is why an exception
  is recorded *as well* — a gap in the calendar means "not filled in yet", so
  without the exception the next top-up would put a deleted day straight back.
  That trap is the one thing here that would have shipped broken and looked
  fine for a fortnight.
- **The scope prompt is unavoidable, not a confirmation dialog.** A stop a
  routine produced is two things at once and only the person editing it knows
  which they meant; guessing is silently wrong half the time. `askEditScope`
  resolves `null` when dismissed and every caller reads that as "commit
  nothing". The one case with a single reading is moving a stop to another day —
  a rule has no date — so the series option is withheld rather than offered and
  then reinterpreted.
- **A stale routine slot is replaced, not reconciled.** Every per-day edit
  detaches, so a slot still carrying a `routineId` is by definition unedited,
  and when it disagrees with its rule the rule simply wins. That is what makes
  "this and future days" a one-line `updateRoutine` with no walk over existing
  stops.
- **`usePlaceSearch` was rebuilding its debounce every render**, found by a
  test that only failed under load. `debounce` closes over its own `timer`, so
  a fresh one per render gave `cancel()` a *different* timer from the one
  pending: every re-render between a keystroke and its 350ms deadline orphaned
  a search nothing could then call off. Blurring the field could fire the
  request it had just cancelled, and picking a suggestion could still spend a
  call on the text it replaced. Now `useMemo`'d once — which is also what makes
  the new unmount cleanup (`useEffect(() => search.cancel, [search])`) mean
  anything, since a per-render one would have been handed the wrong timer.
  That leak was visible in the suite as a stray "Botanic Gardens" search
  turning up inside an unrelated test 350ms later. Unrelated to routines; it
  surfaced because the gate was run repeatedly.
- **Testing.** 799 tests across 71 suites. One RNTL trap: Save and Delete now
  *await* the prompt, so `await fireEvent.press(...)` and only then answering
  the mocked `Alert` leaves the press promise pending — and the render never
  recovers for the next test in the file. The prompt has to answer itself from
  the mock's implementation instead.

### Round 13 — the backlog cleared

Everything under "Not started" in `PLAN.md` is done except the widget (which
needs Xcode/WidgetKit). Twelve tasks shipped; what follows is what a future
round needs to know.

- **Store schema versioning is in.** All three persist configs
  (`itineraryStore`, `routineStore`, `settingsStore`) carry `version` and
  `migrate`. The settings store is at version 2 — the first migration sets
  `hasSeenOnboarding: true` for existing installs so returning users skip the
  onboarding primer. The itinerary and routine stores are at version 1 with
  identity migrations, ready for the first breaking change.
- **Onboarding primes location then notification.** A two-step flow on the
  Today screen (`OnboardingPermissionPrimer`), gated by `hasSeenOnboarding`
  in the settings store. Location first (enables nearby weather), notification
  second (enables rain alerts). Each step offers "Allow" and "Not now"; either
  advances. The flow is a `useState` initialised from MMKV (synchronous read,
  so the value is correct on the first render — no flash). Existing users get
  `hasSeenOnboarding: true` from the version-2 migration and never see it.
- **Gap and overlap warnings** are a pure util (`detectScheduleConflicts`) that
  returns time overlaps and implausible-distance gaps (Haversine at 60 km/h
  threshold). Wired into the Plans screen above the SectionList as amber
  banners.
- **Dry-window suggestion** on the edit screen. A separate `useQuery` to
  `getUpcomingForecast` (24hr window) feeds `suggestDryWindow`, which finds the
  nearest dry period when the current slot's period is wet. The banner says
  "{Period} looks dry — Tap to move this stop" and applies the time shift on
  press.
- **Notes field** added to `ItinerarySlot` (optional, no migration needed) and
  rendered as a multiline `TextInput` in `SlotForm`.
- **Packing list** per slot derived from the forecast text
  (`derivePackingList`). Shows "Pack for this stop" with items like "Umbrella —
  rain expected" or "Sunscreen — high UV". Rendered in the edit screen between
  the repeat note and the dry-window banner.
- **Week strip** on Plans (`WeekStrip`). A horizontal row of 7 day cells
  starting from today, each showing the day name, date number, and stop count.
  Today's cell is distinguished with a primary border.
- **Routines screen** (`src/app/routines.tsx`) registered as a modal route.
  Lists all routines with `describeRoutine`, shows exception count, and has an
  empty state. Reachable from a repeat button in the Plans header.
- **Export backup** writes itinerary + routine store state to a JSON file via
  expo-file-system v57's `File` class (not the old `FileSystem.writeAsString`).
  Import is wired in Settings. The backup service uses `Paths.cache` and
  `shareAsync`.
- **Archive pruning** on the Past plans screen. A "Clear before this date"
  action removes finished stops older than a user-selected cutoff.
- **Notification cap warning** in Settings. `notificationCapWarning` computes a
  message when scheduled notifications approach the iOS 64 limit, surfaced as
  an amber banner.
- **Accessibility: swipe-to-delete now has `accessibilityActions`.** The
  `accessibilityActions` live on the `Pressable` inside `ItineraryCard` (not on
  `Swipeable`, which doesn't accept them). Dynamic Type is still open.
- **Haptics** on delete (`hapticDelete` in `useDeleteSlotWithUndo`) and on save
  success/failure (`saveWithFeedback`), via `expo-haptics`.
  `hapticNotification` for success/error, `hapticImpact("medium")` for delete.
- **Testing.** 835 tests across 78 suites. The onboarding primer required
  seeding `hasSeenOnboarding: true` in the Today screen test's `beforeEach`,
  since the primer now renders instead of the empty state for fresh users.

### Round 14 — the archive becomes a tab

Past plans moved from a screen you had to know existed (an archive button
buried in the Plans header, opening a pushed `src/app/past.tsx`) to a third
bottom-nav tab, on the reasoning that it's one of the three things the app is
for — Today, Plans, and what's already happened — not a place you burrow into.

- `src/app/past.tsx` → `src/app/(tabs)/history.tsx`. Being inside `(tabs)`
  changes two things the old screen relied on: it no longer needs its own
  `ToastHost` (the root one in `_layout.tsx` already covers every tab screen)
  or `edges={["bottom"]}` safe-area handling (the tab bar now sits under it,
  so `BottomTabInset` in the list's `paddingBottom` does that job, same as
  Today and Plans). It also gained the title-row header the other two tabs
  have, since a tab screen has no native header to fall back on.
- `appTabs.tsx` gets a third `NativeTabs.Trigger`. Its icon is `sf`/`md`
  (`clock.arrow.circlepath` / `history`) rather than a `src` PNG like the
  other two — there was no History artwork in `assets/images/tabIcons/`, and
  `NativeTabsTriggerIcon` accepts either per trigger, so the two styles
  coexist without needing a matching asset made.
- The Plans-header archive button is gone (redundant with the tab), and the
  copy that used to point at it — on Today and Plans' empty states, in
  `plans.tsx`'s own comments — now says "History" instead of "Past plans" so
  it names the thing you'd actually tap.
- Test coverage moved with the file: `pastPlansScreen.test.tsx` →
  `historyScreen.test.tsx`, importing `@/app/(tabs)/history` per the
  `src/app/` route-collision trap above, plus an assertion that the screen's
  own "History" title renders. The two `plansScreen.test.tsx` cases that
  exercised the removed header button are gone with it.

## Shipped from the feature-idea list

The feature ideas were derived from what was already built — each named the seam
it hung off. These are the ones that shipped, with how the build differed from
the sketch. The open ones live in `PLAN.md`.

### Deeper weather

- **Wind + freshness on the slot card.** `TwentyFourHrForecast.general.wind`
  and `updatedTimestamp` were parsed into our types and then never read.
  *Freshness stayed; wind came back off the card — it never fed the umbrella
  verdict and it was the reading that pushed the meta line into wrapping.
  `SlotForecast.wind` is still parsed, and `formatWind` was deleted with it.*
- **Live station readings, not just forecasts.** `data.gov.sg` exposes
  real-time `rainfall`, `air-temperature`, `relative-humidity` and
  `wind-speed` station feeds in the same `/v2/real-time/api` namespace as
  the three we already call. `findNearestArea` is a generic nearest-by-
  lat/lng match, so it works unchanged against station metadata — that's the
  whole implementation of "is it actually raining at my next stop right
  now", which a 2hr nowcast can't answer.
- **PSI (haze) and UV index.** Both are the same NEA API shape and both
  change the answer to "should I be outdoors" in Singapore in a way rain
  doesn't. (See `UX.md` for the later decision to drop PSI from the card.)
- **Offline / last-known forecast.** A failed fetch produced `source: "error"`
  and "Couldn't load forecast · Retry" with nothing behind it. React Query is
  already the transport (`useWeatherForSlot`), so persisting its cache and
  falling back to the last successful reading — labelled with its age — was a
  cache-layer change, not a service rewrite.
- **Pull-to-refresh on Today/Plans.** `useWeatherForSlot` has a 10-minute
  `staleTime` and only refetched on window focus; there was no user-initiated
  refresh anywhere in the app.

### Smarter notifications

- **Re-check before firing.** `useRainNotificationScheduler` scheduled once, at
  slot-creation time, off a forecast that could be up to four days out — the
  45-minute alert then fired even if the forecast had since cleared.
  Rescheduling on app foreground against a fresh `getForecastForSlot`, reusing
  the existing `notificationId` cancel path, makes the alert reflect the current
  forecast.
- **Morning digest.** One notification at a user-set time listing today's slots
  and whether to bring an umbrella, instead of N per-slot alerts. All the data
  comes from `getTodaysPlan` + `getForecastForSlot`.
- **Quiet hours / per-slot mute.** Follows the same `useSettingsStore` pattern
  as the lead-time control.

### Itinerary intelligence

- **Indoor/outdoor tag per slot.** A `kind: "indoor" | "outdoor"` field on
  `ItinerarySlot` — rain doesn't matter for a slot inside a mall. The sketch
  suggested defaulting by Google Places type.
  *Built manually rather than from Places types, and as an input to the
  existing mute rather than a second suppression beside it — see
  [round 11](#round-11--a-stop-says-whether-its-under-a-roof).
  The persisted-data note turned out not to bite: an optional field with a
  default is what the two before it did too.*
- **Now / next highlighting on Today.** The Today list rendered every slot
  identically regardless of the clock.
  *Done with the `findCurrentOrNextSlot` that already existed — it was
  being computed to anchor the live readings and thrown away. The card
  takes an outline rather than a fill, and `describeSlotTiming` puts "Now"
  or "in 40 min" ahead of the clock times on every card.*

### Data lifecycle

- **Undo delete.** Deletes were immediate and permanent. `cancelAndDeleteSlot`
  was already the single choke point for every delete site, so an undo buffer
  had exactly one seam to thread through — including re-scheduling the
  notification it cancelled.
  *Done as predicted, and it also removed the edit screen's confirmation
  dialog — see [round 9](#round-9--the-backlog-minus-the-one-thing-that-needs-xcode).
  No buffer was needed: the deleted slot is closed over by the toast's action,
  and `restoreSlot` puts it back under its own id.*

### Store schema versioning — resolved in round 13

`kind` shipped without it (round 11), as `notificationsMuted` and
`notificationLeadMinutes` did before it: an **optional** field whose absence has
a defined reading needs no migration, because "not there" is already a valid
value. The task shipped in round 13: all three stores now carry `version` and
`migrate`. The settings store's first real migration (version 2) sets
`hasSeenOnboarding: true` for existing installs. The itinerary and routine
stores are at version 1 with identity migrations, ready for the first
breaking change.
