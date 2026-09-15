# Brelly engineering notes

Context for implementing in this repo: the constraints that aren't guessable from
the code, and what has already been built. `PLAN.md` holds only the open tasks and
links back here.

- [Read this before writing code here](#read-this-before-writing-code-here) — the
  traps. Read before touching tests, the store, weather parsing, Expo config, or
  Firestore/cloud sync.
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
  regex (`expo-router/_ctx.ios.js`) matches _every_ `.ts`/`.tsx` file beneath
  the app root — the only exclusions are `+api`, `+html` and `+middleware`. A
  `settings.test.tsx` there is therefore treated as a route, so Metro bundles
  it and everything it imports into the _app_, and the build dies on
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
- **Never wrap a handler that starts async work in the *synchronous*
  `act(() => …)`.** It leaves React's act queue open, and the damage lands
  somewhere else entirely: every later `render` in that file returns an empty
  tree, so a test three cases down fails with "unable to find an element" and
  points at a component that is fine. A toast's `onPress` is the usual culprit
  — the undo it runs writes to a store, and the seam underneath it
  (`useMuteSlotWithUndo`, `useDeleteSlotWithUndo`) fires a forecast fetch or a
  haptic that outlives the callback. Call it bare, the way every existing test
  does (`useToastStore.getState().toast?.action?.onPress()`), or `await
act(async () => …)`. The bare call is the house style and produces only an
  "update not wrapped in act" warning, which this suite already has plenty of.
- **A gesture-handler method called from a test needs two globals the
  Reanimated mock can't supply.** `swipeableMethods.close()` — what a swipe
  action presses to put the row away — reads the bare global `_WORKLET` to
  decide whether it is already on the UI thread, and builds its spring config
  with `ReduceMotion.System`. A module mock can't declare a global, so
  `jest.setup.js` sets `_WORKLET = false` (true of Jest: everything runs on
  the JS thread) and `__mocks__/react-native-reanimated.js` exports
  `ReduceMotion`. Without them the press throws `ReferenceError: _WORKLET is
not defined`, then `Cannot read properties of undefined (reading 'System')`.
- **Reanimated 4 needs a hand-written test double.** Its own `mock.js`
  re-imports the real entry point, which loads `react-native-worklets`, which
  builds `NativeWorklets` at module scope and throws "Cannot read properties of
  undefined (reading 'loadUnpackers')". `__mocks__/react-native-reanimated.js`
  stands in instead; because it sits next to `node_modules` it's picked up
  automatically, and adding a `jest.mock` factory that requires it makes the
  resolver recurse into itself.
- **A `jest.mock` of `@brelly/core` does not reach inside core.** The barrel is
  one module: replacing its `getForecastForSlot` leaves `forecastProvider`'s own
  `./weather` import untouched, because core's internal calls never pass through
  it. Mock the module — `jest.mock("@brelly/core/services/weather")` — which
  works because Jest keys its registry by *resolved path*, so replacing the file
  intercepts every importer, relative ones included. The `no-restricted-imports`
  rule allows exactly this and forbids the matching `import`. The same trap has
  a second face: anything that `require`s the barrel during setup instantiates
  all 67 core modules before any test file's `jest.mock` factory runs, and a
  module already in the registry keeps the real bindings it closed over — which
  is why `jest.setup.js` reaches `packages/core/src/config` directly for
  `configureCore` rather than going through `@brelly/core`.
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
- **Native tabs keep every screen mounted, so per-screen `useState` is a
  per-screen _copy_.** Today and Plans are both alive at once, and both call
  `useNearbyForecast`. While the location permission lived in that hook's
  `useState`, granting it on one tab left the other still offering "Show
  weather near me" — two independent state machines, and the OS answer reached
  only the one that asked. Device state that any screen can change belongs in a
  store (`deviceLocationStore`), never in a hook that more than one mounted
  screen calls. Anything sharing that shape needs two things the local version
  never did: an in-flight guard, since every consumer syncs in the same commit,
  and a generation counter, since a read started before the user answered will
  otherwise resolve after the grant and overwrite it. A suite can be green and
  still miss all of this — mount two consumers in one `renderHook` or it isn't
  tested.
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
  `timestamp`, not `date`). The same trap applies to Open-Meteo: it's used
  both `weathercode`/`weather_code` and `windspeed_10m`/`wind_speed_10m`
  across API versions — `services/openMeteo.ts`'s field names were confirmed
  against a live curl, not the docs.
- **Open-Meteo's `hourly.time`/`daily.time` carry no timezone suffix at
  all**, even with a timezone param set — `timezone=auto` returns the
  location's _local_ wall-clock time with nothing to disambiguate it from
  the runtime's own local time if parsed naively (`new Date("2026-08-17T00:00")`
  is read as local-to-the-device, not local-to-the-forecast-point).
  `services/openMeteo.ts` requests `timezone=UTC` instead and appends `"Z"`
  before parsing, so every timestamp is explicit UTC — deliberately giving up
  the location's own local day boundary rather than risk silently mixing two
  different "local"s.
- **A new weather provider is a translator, not a parallel UI.** Open-Meteo
  reports condition as a numeric WMO code, not English text, but
  `wmoWeatherCode.ts`'s `wmoCodeToForecastText` deliberately emits strings
  that reuse NEA's own vocabulary ("Light Rain", "Fair (Day)", "Thundery
  Showers") — so `WeatherIcon.tsx`'s `forecastToSymbol`,
  `shouldNotifyForRain`, and `derivePackingList` all keep working for
  Open-Meteo forecasts with zero changes of their own. Snow/sleet codes
  (71–77, 85–86) fall back to the generic "Partly Cloudy" reading — out of
  scope while the only overseas markets are tropical SEA ones; a future
  non-tropical market needs those keyword lists extended, not just the
  translator.
- **Every forecast-fetching call site must go through
  `getForecastForSlotByProvider` (`services/forecastProvider.ts`), never
  `getForecastForSlot`/`slot.neaRegion` directly.** `useRainNotificationScheduler`
  originally called NEA's fetcher straight from the slot, bypassing
  `useWeatherForSlot` entirely — a call site added this way for an overseas
  slot would silently schedule its rain alert off Singapore's `"central"`
  fallback forecast instead of erroring. `slot.neaRegion` stays populated
  (and meaningless) even on an Open-Meteo slot specifically so nothing
  reading it by accident crashes; the dispatcher is the only thing allowed
  to treat it as authoritative.
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
- **CI gates on coverage, so a new file with no test can fail the build even
  when every test passes.** `package.json`'s `jest.coverageThreshold` requires
  90% statements/functions/lines and 85% branches, measured by
  `collectCoverageFrom` over _all_ of `src/**` — not just the files a test
  happens to import — with `src/test/**` (the fakes and render helpers)
  excluded. That scope is the point: an untested module counts as zeros rather
  than being invisible. The `Test` step in `.github/workflows/ci.yml` runs
  `yarn test:coverage`, and Jest exits non-zero on a breach; run that script
  locally to see the same number CI will. Current headroom is small (94%
  statements, 89.7% branches), so the threshold is a floor to hold, not slack
  to spend.
- **Native modules need their config plugin in `app.json`.** `expo-location`
  without its plugin means `NSLocationWhenInUseUsageDescription` never reaches
  Info.plist and the iOS permission prompt silently fails. `expo-calendar` and
  `expo-notifications` now carry theirs too — the latter's `icon`/`color`, or
  Android falls back to a generic bell.
- **`ios/` is gitignored, so anything you fix by hand in there is gone on the
  next prebuild.** Three native build fixes live in `plugins/` as local config
  plugins registered at the end of `app.json`'s `plugins` array — two patch
  the generated `Podfile`, one patches the Xcode project. Each is anchored on
  a specific bit of the Expo template and **throws** if that anchor moves,
  rather than silently doing nothing; if a prebuild starts failing with a
  `withXxx: no … found` error, an upstream template changed and the patch
  needs re-anchoring. Each plugin's header comment names the upstream bug and
  the condition under which it can be deleted. The three traps below are what
  they exist for.
- **An iOS purpose string can only be deleted when the *binary* holds no
  reference to the API — not when your code holds no call to it.** Apple's
  upload scan is static: `expo-location` compiles in a `CMMotionActivityManager`
  call, so deleting `NSMotionUsageDescription` failed processing with ITMS-90683
  even though no JS path reaches motion (round 35). Before setting a permission
  prop to `false` in `app.json`, grep the pod's own `ios/` sources for the API,
  and remember `ios/` on disk is stale until you re-run `expo prebuild` — a
  local build will keep passing with the old keys still in Info.plist.
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
- **Expo's precompiled modules are built by one exact Swift compiler, and a
  newer Xcode cannot load them.** `ios.usePrecompiledModules` is `false` in
  `app.json`'s `expo-build-properties` for that reason, and the failure it
  prevents names the wrong culprit: `cannot link directly with 'SwiftUICore'
because product being built is not an allowed client of it`, then `Undefined
symbols for architecture arm64`. Nothing in this repo, or in any prebuilt
  binary it links, mentions SwiftUICore. The chain is that a binary
  `.swiftmodule` only loads in the compiler that produced it — SDK 57's
  xcframeworks ship Swift 6.3.1 (Xcode 26.5), so Xcode 26.6 (Swift 6.3.3)
  falls back to rebuilding `ExpoModulesCore` from its `.swiftinterface`, and
  that interface is full of `SwiftUICore.View` and `SwiftUICore.Color` from
  `ExpoSwiftUI`. The rebuild makes every client autolink `-framework
SwiftUICore`, and `SwiftUICore.tbd` allows `SwiftUI` as its only client.
  Six frameworks carry the mismatch: `ExpoModulesCore`, `ExpoImage`,
  `ExpoFont`, `ExpoLocation`, `ExpoFileSystem`, `ExpoModulesWorklets`. Don't
  reach for a version bump — `expo-modules-core` was already on the newest 57
  patch. To see the real error instead of the linker's, compile one line that
  imports the framework: `xcrun --sdk iphonesimulator swiftc -target
arm64-apple-ios16.4-simulator -F <xcframework slice> -c t.swift` says `this
SDK is not supported by the compiler` and names both versions. The cost is
  that Expo modules build from source; React Native itself stays prebuilt,
  since `RCT_USE_PREBUILT_RNCORE` is a separate property. The property can go
  when Expo's prebuilds match the local toolchain — flip it back, `pod
install`, and compare `head -2` of any shipped `.swiftinterface` against
  `swift --version`.
- **`ios/build/` is not scratch space — `pod install` generates the codegen
  headers into it.** `ios/build/generated/ios/ReactCodegen/` holds
  `NitroModulesSpec.h` and every component's `States.h`. Deleting `ios/build`
  _after_ a `pod install` fails the next build with `The file
"NitroModulesSpec.h" couldn't be opened because there is no such file. (in
target 'ReactCodegen')`, which reads like a `react-native-nitro-modules`
  problem and is not one — the build's own codegen phase does not put them
  back. The `rm -rf Pods Podfile.lock build` in the bullet above is safe only
  because `pod install` runs after it; in the other order, run `pod install`
  again.
- **`@expo/ui` can't see React's Objective-C headers, and the fix is a
  Podfile patch.** Compiling `ExpoUITouchHandlerHelper.mm` fails with
  `'React/RCTSurfaceTouchHandler.h' file not found`, which reads like an
  `@expo/ui` version problem and is not one — the file is in 57.0.7 too, so
  there is no patch release to move to. Because `RCT_USE_PREBUILT_RNCORE=1`,
  React ships as a prebuilt `React.xcframework` whose headers live under
  `React_Core/`, `React_RCTFabric/` etc. rather than `React/`. Clang resolves
  `React` as a _framework_, doesn't find the header in it, and never falls
  back to the `-I` paths that do contain it — the giveaway is the `note: did
not find header … in framework 'React'` under the error.
  `ios/Pods/React-Core-prebuilt/React-VFS.yaml` overlays a virtual `React/`
  directory onto `React.xcframework/Headers`, so **both** `-ivfsoverlay` and
  an `-isystem` for that directory are needed; the overlay alone still fails.
  `ExpoUI.podspec` declares `s.dependency 'React-RCTFabric'` but never calls
  React Native's `add_rncore_dependency`, so it is the only Expo pod that
  imports a React ObjC header with neither flag — its xcconfig has no
  `OTHER_CFLAGS` line at all. `plugins/withExpoUiReactHeaderFix.js` adds them
  in `post_install`.
- **A freshly prebuilt `ios/` needs `pod install` to run twice, and one of
  the plugins is why it no longer does.** RNFirebase does four things to the
  app's own target in `firebase_spm.rb`, and every one of them first checks
  that the target already has a `[CP] Embed Pods Frameworks` phase —
  `rnfirebase_add_spm_embed_phase`, `rnfirebase_verify_spm_embed_phase_applied!`,
  `rnfirebase_add_spm_core_to_app_target` and
  `rnfirebase_fix_spm_archive_signature_collision`. All four run from
  `post_install`, and CocoaPods only adds that phase while "Integrating client
  project", _after_ `post_install` — so on a newly created `ios/` all four
  silently skip. A second `pod install` fixes it because the phase now exists.
  `plugins/withFirebaseSpmPostIntegrate.js` re-runs RNFirebase's own
  (idempotent) functions from `post_integrate`, which runs after integration,
  so one prebuild is enough.
  The three failures that hides, in the order they were hit: the app crashes
  at launch with a missing-library dyld error (no embed phase); the build dies
  at link time with `Undefined symbols … "_OBJC_CLASS_$_FIRApp", referenced
from: in AppDelegate.o` (no FirebaseCore link); and a Release _archive_
  fails in fastlane with `"openssl_grpc.xcframework-ios.signature" couldn't be
copied to "Signatures" because an item with the same name already exists`
  (no signature-collision phase). Note
  `rnfirebase_verify_spm_embed_phase_applied!` exists to catch the first of
  those and carries the same guard as the function it verifies, so on a fresh
  `ios/` it skips too and never fires — re-running it is what makes it a real
  safety net.
  **This only ever bites on EAS, never locally**, which is what made it hard to
  see: EAS Build prebuilds a fresh `ios/` on every run and so gets the
  first-`pod install` behaviour every time, while a local checkout had its
  second `pod install` long ago. Don't conclude from a green local build that
  the plugin is redundant; check the generated project —
  `grep -c 'name = "\[RNFB\]' ios/brelly.xcodeproj/project.pbxproj` returns 2,
  the Embed and Remove-duplicate phases. Match on `name = ` and don't count
  bare `[RNFB]` (that returns 9, since each phase is referenced several times);
  and note the third RNFB phase, `[CP-User] [RNFB] Core Configuration`, is
  CocoaPods' own `script_phase` and lands with or without this plugin, so it is
  not the thing to check. The A/B is on record: from a deintegrated project
  with those two phases deleted, one `pod install` restores both with this
  plugin and neither with the pre-fix version, which is exactly what EAS
  build 4 shipped.
- **Xcode 26's explicit modules break Firebase's SPM targets, and neither
  React Native nor RNFirebase turns them all the way off.** RNFirebase 26
  resolves `firebase-ios-sdk` over SPM, and Firebase's internal SPM targets
  aren't public products, so the Xcode 26 dependency scanner refuses them:
  `'FirebaseCore' is missing a dependency on 'FirebaseCoreInternal'`. React
  Native's `react_native_post_install` clears `SWIFT_ENABLE_EXPLICIT_MODULES`
  project-wide but never the Clang half; RNFirebase's
  `rnfirebase_apply_spm_build_settings` clears both halves but only walks
  `project.native_targets`, so the _project-level_ configurations keep
  `CLANG_ENABLE_EXPLICIT_MODULES` — and Swift Package targets inherit from
  the project. `plugins/withExplicitModulesDisabled.js` closes the gap by
  setting both on every configuration. Don't delete it because the settings
  "look already handled"; check `grep -c 'CLANG_ENABLE_EXPLICIT_MODULES = NO'
ios/brelly.xcodeproj/project.pbxproj` returns 4, not 2.
- **`ios.useFrameworks` is `"dynamic"`, and rnfirebase.io's Expo page will
  tell you otherwise.** That page says `"static"`; RNFirebase 26 pulls
  `firebase-ios-sdk` through SPM, and that Swift Package only ships dynamic
  products, so `pod install` now aborts with `SPM + static linkage is not
supported`. Static is only reachable via `$RNFirebaseDisableSPM = true` in
  the Podfile, which we don't need. `FIREBASE_MIGRATION.md` carried the wrong
  version of this for a while — the note there is corrected.
- **The `[RNFB] Embed Firebase SPM Frameworks` phase over-collects, and only a
  real archive shows it.** `rnfirebase_spm_embed_script` sweeps two folders.
  The second, `${OBJROOT}/UninstalledProducts/${PLATFORM_NAME}`, is only
  populated by the Archive action — and it holds _every_ archive-time build
  product, CocoaPods' static pod frameworks included, not just Swift Package
  ones. The sweep is a bare `find -name "*.framework"`, so all of them get
  copied into `Frameworks/`, and App Store validation rejects a static `ar`
  archive there as ITMS-90171. `plugins/withFirebaseSpmPostIntegrate.js`
  splices a `file -b`-based guard into the phase so it only embeds dynamic
  frameworks. Nothing local can catch this: the sweep is inert outside an
  archive, the EAS build itself _succeeds_, and the rejection only lands at
  `eas submit`. Check the artifact, not the build status — `unzip` the `.ipa`
  and run `file` over `Payload/*.app/Frameworks/*.framework/*`; everything
  there must be a Mach-O dylib.
- **`getPlaceDetails`'s field mask is a billing decision, and nothing fails
  when you get it wrong.** Places (New) prices Place Details by _which fields
  you ask for_: the mask is what puts the call on the Essentials SKU rather
  than Pro or Enterprise, and adding one field from a higher tier silently
  reprices every location a user picks. `addressComponents` (round 26's
  `countryCode`) was added only after checking Google's SKU table put it in
  Essentials alongside `id`/`displayName`/`formattedAddress`/`location`. The
  response shape needs the same treatment as NEA's above — confirmed by curling
  the endpoint, which is how the country component turned out to carry the
  code in `shortText` and the country's _name_ in `longText`.
- **A native picker's props are invisible when the mock drops them.** The
  `DateTimePicker` stub in `jest.setup.js` forwards `themeVariant`, `mode`,
  `value` and `onValueChange` on purpose: each was, at some point, the only
  thing a test could check. `themeVariant` is what keeps the picker in the
  app's theme rather than the device's, and `mode` is the only way to tell the
  Day picker apart from Starts and Ends. Adding a prop the mock swallows means
  the test passes and the app is wrong.
- **A slot's `notificationId` must never leave the device that wrote it.** It
  is a handle into _this_ device's notification queue, and
  `notificationLeadMinutes` is the lead time that particular alert was
  scheduled against. Carried anywhere else — into a backup file, onto a second
  device, or back onto this one after the alert was cancelled — the stop looks
  permanently scheduled: `planNotificationResync` reads `!!notificationId` as
  "has an alert", finds the lead time unchanged, and does nothing, so no alert
  is ever scheduled and nothing on screen says so. Worse, it _half_-works: if
  the receiving device's `rainLeadMinutes` differs from the imported one the
  resync cancels and reschedules, so the bug only bites when they agree — the
  default. Anything moving a slot across a device or account boundary goes
  through `stripNotificationHandles`. Note the strip is **not** in
  `restoreSlot`, which files whatever it is handed; it lives in the callers,
  which is precisely how `backup.ts` shipped without it. Every Firestore write
  path added by the cloud-sync migration (below) is a caller too:
  `itinerarySync.ts`'s `writeSlot`/`writeSlotFields` exclude
  `notificationId`/`notificationLeadMinutes` unconditionally via a
  `DEVICE_LOCAL_FIELDS` set rather than trusting each call site to remember,
  and settings' equivalent, `digestNotificationId`, is excluded by
  `toCloudSettingsFields` the same way. `firestore.rules` rejects both outright
  as a second line of defence — a client bug that forgot to strip would be
  denied server-side rather than silently syncing the handle.
- **A routine-materialised slot's id must be deterministic, or two devices
  double-book every day the routine covers.** `useRoutineSync`'s mount effect
  calls `planRoutineMaterialization` immediately at cold boot, from
  `getState()` on both stores. That function dedupes by `(routineId, date)`
  against the plans it's handed, so it's idempotent _given accurate state_ —
  but with no MMKV seed (see "No MMKV boot-time seed" below), cold-boot state
  is empty until the first Firestore snapshot lands, not just stale. A random
  id per materialised slot means the mount effect re-mints and re-writes every
  upcoming occurrence on every launch — on one device that's silent
  duplication (two slots per day, two rain notifications, forever); across two
  devices it's worse, because each writes its own random id for the same
  `(routineId, date)` and the snapshot delivers both. Two changes close it:
  materialised slots get the deterministic id `r_{routineId}_{date}`
  (`materializedSlotId` in `routineOccurrences.ts`), so a second device's write
  is a same-doc-id overwrite rather than a duplicate even if both foreground
  before either has seen the other's write; and `useRoutineSync`'s mount
  effect is gated on `useCloudReady()` so it doesn't run against empty state at
  all. The id scheme alone isn't enough — it stops duplicates but not the
  pointless write burst — and the gate alone isn't enough either, since two
  devices can still foreground in the same instant. **Detaching a slot with
  "this day only" must re-key it to a fresh random id**, not keep the
  deterministic one: otherwise removing the exception later re-derives the
  same id and the materialiser overwrites the stop the user deliberately kept.
- **`useNavigation` is mocked, and something depends on it.**
  `useUnsavedChangesGuard` disables a modal's swipe-to-dismiss through
  `setOptions({ gestureEnabled })`, which is the _only_ trace it leaves —
  there's no rendered output to assert on. The shared navigation object in the
  `expo-router` mock exists for that.
- **The installed Firestore SDK is modular-only — there is no chained
  `firestore().collection().doc()` API.**
  `@react-native-firebase/firestore@26.1.0`'s entry point has no default
  export, only named modular exports (`getFirestore`, `collection`, `doc`,
  `onSnapshot`, `writeBatch`, `setDoc`, `updateDoc`, `deleteDoc`,
  `linkWithCredential`, …). Writing the namespaced form type-checks against
  older docs/examples and fails at the call site. The test doubles
  (`src/test/fakeFirestore.ts`, `src/test/fakeAuth.ts`) fake the modular
  _functions_ for the same reason — a chained mock object would fake an API
  that no longer exists.
- **`ios.useFrameworks` stays `"dynamic"`.** RNFirebase 26 resolves
  `firebase-ios-sdk` through SPM, and that Swift Package only ships dynamic
  library products — `"static"` (what rnfirebase.io's own Expo page
  recommends) makes `pod install` abort with `SPM + static linkage is not
supported`. Static is only reachable via `$RNFirebaseDisableSPM = true` in
  the Podfile, which this app doesn't need.
- **Zustand `persist`/MMKV came off all three stores** (`itineraryStore`,
  `routineStore`, `settingsStore`) when they moved to Firestore — there is no
  `version`/`migrate` on any of them any more, and the old
  "store schema versioning" task below is obsolete. A store starts at its
  Zustand defaults on cold boot and is hydrated by the first `onSnapshot`
  delivery; screens that used to render instantly from a persisted seed must
  gate on `useCloudReady()` and show `<Skeleton>` first, or they show a
  confident empty state (with a CTA) that then swaps to real data. See
  "Built so far" below for what's covered and `FIREBASE_MIGRATION.md` for the
  full phase-by-phase reasoning — kept on disk rather than deleted, since
  dozens of comments across `src/` cite it by section name; round 16 below is
  the condensed version for anyone who doesn't need the whole thing.
- **A swallowed bootstrap failure reads as an infinite skeleton, not an
  error.** `useCloudBootstrap`'s sign-in `.catch()` and every `onSnapshot`
  listener started life with no error handling — deliberately, so a failure
  wouldn't crash the boot path — but with no logging either, a rejected
  `signInAnonymously()` (e.g. Anonymous auth left disabled in the Firebase
  console: `[auth/unknown] This operation is restricted to administrators
only.`) or a rules-denied listener left every screen on `<Skeleton>`
  forever with nothing in the logs to say why. `cloudSyncStore`'s
  `bootstrapError` now catches both paths — `useCloudBootstrap`'s catch block
  and `cloudListeners`' per-listener `onError` — and every skeleton screen
  renders it with a "Try again" button wired to `retryCloudBootstrap()`
  instead of spinning. The screen shows `describeCloudSyncError()`'s fixed,
  friendly copy ("We couldn't load your plans…") — not the raw
  `[auth/unknown]`/`[firestore/permission-denied]` code, which means nothing
  to someone who isn't debugging it — but every call site still
  `console.error`'s the real error first, so the Firebase console/Metro log
  names the actual cause. `runBootstrap`'s effect-mounted call takes an
  `isCancelled` check for exactly the reason the original inline `cancelled`
  flag existed: React's dev-mode double-invoke or a Fast Refresh remount can
  leave two bootstrap attempts in flight, each independently enqueueing the
  same local→cloud migration write — losing that guard while adding
  `retryCloudBootstrap` reintroduced the race it was written to close.
- **A key present with a literal `undefined` value crashes a Firestore write
  outright, and the test double didn't know that.** `stripNotificationHandles`
  used to set `notificationId`/`notificationLeadMinutes` to `undefined`
  rather than omit them — fine for local Zustand state, fatal the moment a
  caller wrote the result to Firestore (`Unsupported field value: undefined`).
  It now destructures them out instead, which is also the more correct
  reading of the type: both fields are optional, and "absent" is their
  documented "never scheduled" state. The same crash was reachable from
  ordinary, non-buggy data too — an "ongoing" routine is built with
  `endDate: undefined` (`plan/new.tsx`), so creating one used to fail
  `writeRoutine`. `omitUndefinedFields` (`src/utils/`) is the general fix,
  applied at every full-document Firestore write:
  `routinesSync.ts`'s `writeRoutine` and the three call sites that build a
  whole doc from local/imported state — `localDataMigration.ts`,
  `backup.ts`'s import, and `accountLinkService.ts`'s merge write. The merge
  write had a second, independent bug: it never called
  `stripNotificationHandles` at all, so a merged slot's rain-alert handle
  leaked into the joined account — the exact trap the function's own doc
  comment warns about, missed because the account-link path was added after
  that comment was written and nothing forced every new caller to re-read it.
  None of this was visible in `yarn test` before now because
  `src/test/fakeFirestore.ts`'s `.set()` happily stored a literal `undefined`
  in its in-memory map — it now throws the same way the real SDK does, which
  is what caught `writeRoutine`'s bug the moment it was written.
- **EAS Build only uploads git-tracked files, so `app.config.js` must be
  committed or the Firebase config silently vanishes.** `GoogleService-Info.plist`
  and `google-services.json` are gitignored (this repo is public and they carry
  real project identifiers), so they never reach the builder as files. The
  bridge is `app.config.js`, which overrides `app.json`'s
  `ios.googleServicesFile` / `android.googleServicesFile` with
  `GOOGLE_SERVICES_INFO_PLIST` / `GOOGLE_SERVICES_JSON` — EAS `file`-type
  environment variables whose value at build time is the path to the uploaded
  file. Two things have to be true at once, and each fails the same way
  (`"GoogleService-Info.plist" is missing, make sure that the file exists`):
  the dynamic config has to be _tracked by git_ (an untracked `app.config.js`
  is not uploaded, so EAS reads `app.json` alone and looks for the gitignored
  relative path), and the file variables have to _exist on EAS_ for the
  environment the build profile names in `eas.json` (`production` →
  `"environment": "production"`). Both are set now, on `production`, `preview`,
  and `development`, via
  `eas env:set --type file --visibility secret --name GOOGLE_SERVICES_INFO_PLIST --value ./GoogleService-Info.plist`.
  They are `secret`, so `eas env:list` shows `*****` and they cannot be read
  back — to rotate one, re-run `env:set` from a local copy. `app.config.test.js`
  pins the override precedence in both directions so a refactor cannot quietly
  drop it.
- **That bridge covers the builder, not the machine that runs `eas build`.**
  `eas build` evaluates the app config _locally_ before uploading anything, so
  a CI runner needs `GoogleService-Info.plist` on disk too — and it will not
  get it from the EAS file variable, because those are `secret`-visibility and
  EAS keeps secrets on the builder. The build log names what it did send:
  `Environment variables with visibility "Plain text" and "Sensitive" loaded
from the "production" environment`. With the variable unset, `app.config.js`
  falls back to `app.json`'s gitignored relative path and the run dies on
  `withIosInfoPlistBaseMod: ENOENT ... GoogleService-Info.plist`. The iOS
  release workflow writes the file from a base64 repo secret before building.
  This never reproduces from a working copy, where the real file is sitting
  there — reproduce it the way the runner sees things instead, in seconds and
  without pushing:

  ```
  git archive --format=tar HEAD | tar -x -C /tmp/brelly-clean
  cd /tmp/brelly-clean && yarn install --frozen-lockfile
  npx expo config --type introspect
  ```

  `git archive` is the right tool because EAS also uploads only tracked files,
  so it gives exactly what the builder gets.

- **The iOS release workflow authenticates to Apple through an App Store
  Connect API key held on EAS, not through an Apple ID in repo secrets.** This
  repo is public, so the Apple account email and an app-specific password both
  stay out of it. `eas credentials --platform ios` → _App Store Connect: Manage
  your API Key_ → _Set up your project to use an API Key for EAS Submit_ stores
  the key against the project; from then on `EXPO_TOKEN` is the only secret the
  workflow needs, and `eas submit --non-interactive` reads the key itself. The
  earlier `EXPO_APPLE_ID` env var on the submit step is gone — restoring it
  would also require `EXPO_APPLE_APP_SPECIFIC_PASSWORD`, which is the thing
  this avoids. `EXPO_TOKEN` is a **robot user on the `brelly` org** (matching
  `app.json`'s `owner`), Developer role: the docs scope that to "create new
  projects, make new builds, release updates, and manage credentials", which is
  exactly what build + submit touch, and it withholds billing and member
  management. A robot on a personal account cannot see the project at all.
  `eas.json`'s `submit.production.ios` is deliberately empty: there is no App
  Store Connect app record yet, so there is no `ascAppId` to set, and the API
  key is already scoped to one team so `appleTeamId` adds nothing. Placeholder
  strings were worse than absence — EAS forwards them to Apple verbatim. Once
  the record exists, put the real `ascAppId` back, because it is what makes
  submit skip the find-or-create-the-app step that `--non-interactive` handles
  badly.
- **An over-the-air update that no build can run fails silently, and the
  `fingerprint` runtime-version policy is what makes that detectable.**
  `app.json` sets `runtimeVersion: { policy: "fingerprint" }`, so a build and
  an update only match when `@expo/fingerprint`'s hash of everything
  native-affecting agrees — dependencies, the evaluated app config, the config
  plugins, `expo-build-properties`. Publish an update whose fingerprint no
  installed build carries and EAS accepts it happily; it simply reaches nobody,
  and the fix looks shipped. `.github/workflows/ota-update.yml` therefore
  refuses to publish unless `eas build:list --fingerprint-hash <local hash>`
  matches a finished build on the target channel. **Adding or bumping any
  native dependency moves the fingerprint**, so it needs a new build before an
  OTA can follow — including the commit that added `expo-updates` itself
  (`4a3684c…` → `661ed17…`).
- **The fingerprint hashes `GoogleService-Info.plist`'s _contents_, not its
  path — which is the only reason the `app.config.js` file-variable bridge
  above does not break it.** The builder reads the plist from an absolute EAS
  path and a runner reads `./GoogleService-Info.plist`, but both are recorded
  as `expoConfigExternalFile:contentsOnly`, so the two hashes agree. Verified
  by hand, not assumed: computing the fingerprint twice with
  `GOOGLE_SERVICES_INFO_PLIST` set and unset returns the same hash. The
  consequence is a coupling worth knowing about — the plist held on EAS as the
  `GOOGLE_SERVICES_INFO_PLIST` file variable and the one in the
  `GOOGLE_SERVICES_INFO_PLIST_BASE64` repo secret must stay byte-identical.
  Rotate one and not the other and every subsequent update computes a runtime
  version no build has. The guard above turns that from a silent no-op into a
  failed run, but it cannot tell you _which_ of the two drifted;
  `eas fingerprint:compare --build-id <ID>` can.
- **`--environment` is mandatory on `eas update` from SDK 55 on**, and it has
  to name the same EAS environment the target channel's build profile uses in
  `eas.json` (`production` → `production`, `preview` → `preview`). Get it wrong
  and the config is evaluated against a different set of variables than the
  build was, which shows up as a fingerprint mismatch with no obvious cause.
- **The widget is native, and the verification gate cannot see it.** The
  WidgetKit extension lives in `targets/widget/` (`index.swift` +
  `expo-target.config.js`) and is generated into the Xcode project by
  `@bacons/apple-targets` on `expo prebuild` — `ios/` is gitignored, so the
  target does not exist in the repo, and `tsc`/`lint`/`test` never compile or
  render a line of it. Its only in-repo verification is
  `npx expo config --type introspect`, which confirms the target is discovered
  and both bundle ids carry the App Group; everything past that is a device
  build. What _is_ testable is the JS that feeds it:
  `buildWidgetSnapshot` (`src/services/widgetSnapshot.ts`) reduces the upcoming
  stops to the next-stop glance, and `writeWidgetSnapshot`
  (`src/services/widgetBridge.ts`) serialises it into the shared container.
  **The Swift `WidgetSnapshot`/`NextSlot` decoder mirrors that TS type field for
  field** — the two processes share no types, only the JSON shape, so a field
  added on one side is silently dropped on the other until added to both.
- **The App Group id is written in four places and they must agree**, or the
  app writes to one container and the widget reads an empty other one:
  `WIDGET_APP_GROUP` in `src/services/widgetBridge.ts`, the app's own
  `ios.entitlements` in `app.json`, the target's `entitlements` in
  `targets/widget/expo-target.config.js`, and `SnapshotStore.appGroup` in
  `targets/widget/index.swift`. Likewise `WIDGET_KIND` in `widgetBridge.ts` must
  equal the Swift `Widget`'s `kind`, or `reloadWidget(kind)` refreshes nothing.
  The widget rides on the existing notification sync: `runNotificationSync`
  already re-fetches every upcoming stop's forecast on mount and every
  foreground, so it writes the snapshot at the end of that pass at no extra
  network cost — there is no separate schedule to keep in step.
- **`ios.appleTeamId` is the one value the widget build needs that is not in the
  repo.** `@bacons/apple-targets` warns `Expo config is missing required
  ios.appleTeamId` during introspection, and an iOS build that signs the extra
  target needs it. It is left unset on purpose, the same way the Apple account
  details are (this repo is public and its credentials live on EAS) — a
  hardcoded placeholder is worse than absence because signing forwards it
  verbatim, exactly as the App Store Connect note above warns. Set it in
  `app.json` before a local device build, and register the App Group capability
  against **both** `com.sg.brelly.app` and `com.sg.brelly.app.widget` in the
  Apple Developer account (EAS can manage the provisioning profiles once the
  capability exists). Adding the target also moves the `fingerprint` runtime
  version, so it needs a fresh build before an OTA can follow it (see the
  fingerprint traps above).
- **Jest has to be run with the cwd inside the workspace.** `yarn workspace
  @brelly/mobile test` does that; `npx jest -c apps/mobile/jest.config.js` from
  the repo root does not, and the difference is silent. Three things in
  jest-expo and jest resolve against `process.cwd()` rather than `rootDir`:
  `withTypescriptMapping.js:59` reads `tsconfig.json`, `jest-preset.js:44`
  calls `resolveBabelOptions(process.cwd())`, and — the leg that actually rules
  out a root `projects` array, because no per-project config can work around it
  — `CoverageReporter.js:350` resolves `coverageThreshold`'s path keys the same
  way. A run from the wrong directory checks less than it claims to.
- **Coverage does not cross a `rootDir` boundary**, so the two suites carry two
  separate gates and there is nothing to merge. Measured, because it looks like
  it ought to work: with `../../packages/core/src/**` in `apps/mobile`'s
  `collectCoverageFrom`, `shouldInstrument` returns `true` for a core file, the
  file loads and executes, and it still never reaches the coverage map — the
  threshold group then fails with `Coverage data for ../../packages/core/src/
  was not found`. `apps/mobile` gates `src/**` at 90/85/90/90 and
  `packages/core` gates itself at 95/90/95/95.
  The hole that leaves is worth knowing: the five sync services in core are
  excluded from core's own gate, because their tests live in `apps/mobile`
  (they exercise the mobile bindings, and import `expo-notifications` and
  `@/store/mmkvStorage`). They are tested, thoroughly; they are just not behind
  a coverage threshold in either workspace, and neither would a new one be.
- **The `no-restricted-imports` patterns are gitignore syntax, not minimatch.**
  ESLint 9 matches them with the `ignore` package, where an unanchored pattern
  matches any path *segment* — so a bare `firebase` in the core boundary rule
  matched `@brelly/platform/firebase`, the seam the rule exists to send people
  to. Every pattern in `eslint.config.js` is anchored with a leading slash for
  that reason. The mirror-image trap: a slash makes a pattern a path segment,
  so `react-native/**` does **not** match `react-native-mmkv` — which is the
  import the rule was written to catch. `react-native-*` is listed separately.
- **Keeping `apps/mobile/ios` and `apps/mobile/android` git-ignored holds the
  project in the *managed* workflow for fingerprinting.** `@expo/fingerprint`'s
  `ProjectWorkflow.resolveProjectWorkflowAsync` flips managed to generic when
  `ios/` is not ignored, and does not then add `ios/**/*` to the ignore paths,
  so the whole generated tree — `Pods/`, `build/` — becomes a hashed source and
  local and CI stop agreeing on the runtime version. The rules live at the repo
  root rather than in an `apps/mobile/.gitignore`: `isFileIgnoredAsync` shells
  `git check-ignore` from the VCS root, so the two are equivalent.
  Five rules in `.gitignore` are path-anchored, and `targets/*/Info.plist` is
  anchored as firmly as `/ios` is — a slash anywhere in the pattern anchors it.
- **The fingerprint hashes `package.json` `scripts`, not `dependencies`.**
  `@expo/fingerprint`'s `getPackageJsonScriptSourcesAsync` (`Bare.js:45-68`)
  reads only `scripts`, and none of the 15 sourcers reads `dependencies`. So
  renaming a script in `apps/mobile/package.json` freezes OTA until a new
  native build ships, and adding a dependency does not. `expoAutolinkingConfig`
  is hashed too, and its source ids are relative to the project root — which is
  why moving the app bumped the hash for all ~150 of them at once.
- **The hashed `.gitignore` is `apps/mobile/.gitignore`, not the root one.**
  `getGitIgnoreSourcesAsync` (`Bare.js:70-80`) reads `<projectRoot>/.gitignore`,
  and the project root is `apps/mobile` now — so editing the root `.gitignore`
  no longer moves the fingerprint, and editing the app's does.
  **`apps/mobile/.gitignore` is therefore committed although every rule in it is
  redundant.** It is `@generated` by expo-cli, which recreates it on any `expo
  start` or `expo prebuild`, and the sourcer contributes nothing when the file
  is absent — so leaving it untracked means every developer machine hashes it
  and a fresh CI checkout does not. Measured: `5643fd7c…` with it,
  `4703a201…` without. That divergence is silent, and it lands as an OTA update
  that reaches nobody. Do not "tidy" the file away because the root
  `.gitignore` already ignores `expo-env.d.ts`; it is not there to ignore
  anything.
  Note this is a *different* mechanism from the one that keeps `ios/` ignored:
  `isFileIgnoredAsync` shells `git check-ignore` from the VCS root, so the
  native-folder rules go on working from the root `.gitignore`.
- **No `metro.config.js` is needed, and no `babel.config.js` either.**
  `@expo/metro-config` 57.0.9 auto-detects the workspace
  (`getWatchFolders.js`, `getModulesPaths.js:12-19`). Recorded so nobody
  "fixes" it by adding one.
- **`tests/firestore-rules/*.ts` is in no TypeScript program**, and that is the
  one real loss from dropping the root `tsconfig.json`. It used to be
  typechecked by the root `**/*.ts` glob. That glob also leaked `@types/node`
  into every file in the program, through the emulator suite's own
  `/// <reference types="node" />` — which is why `packages/core/src/index.test.ts`
  now asks for those types itself.
- **The `@/assets/*` tsconfig mapping has never worked.** `--showConfig` orders
  `^@/(.*)$` before `^@/assets/(.*)$`, so the general alias shadows it — and
  `apps/mobile/src/assets/` does not exist. Pre-existing, unrelated to the
  monorepo, and still unfixed.

### `apps/web`

- **Tailwind's own utilities do not exist in this app.** `globals.css` clears
  the default namespaces (`--color-*: initial`, and the same for spacing,
  radius, text, font, shadow) and re-declares them from the tokens, so `p-4`,
  `rounded-lg` and `bg-slate-200` compile to nothing. The classes that work are
  `px-three`, `rounded-control`, `bg-background-element`, `text-title`. That is
  on purpose: it turns the `ui-implementation` skill's "never write a raw value"
  into something the compiler enforces rather than something to remember.
- **The CSS custom properties are emitted at render time**, by `buildTokensCss()`
  in the root layout — there is no generated file to keep in step and no build
  ordering to get wrong. The TypeScript in `packages/core/src/constants/theme.ts`
  is the only copy of the palette.
- **Any test that writes to a core store needs the Firebase mocks.** The write
  reaches the sync layer, which calls `getAuth()`, so without them the first
  `setState` throws `auth/invalid-api-key`. They are global in
  `apps/web/jest.setup.ts`; adding one there needs `@brelly/core/*` in both the
  Jest `moduleNameMapper` and the tsconfig paths, because the package has no
  `exports` map.
- **Route handlers and anything under `src/server/` need
  `@jest-environment node`.** The web project's Jest environment is jsdom, which
  has no `Response`.
- **Leave `apps/web/next-env.d.ts` as the stock two lines.** `typedRoutes: true`
  rewrites it to reference a generated `./.next/types/routes.d.ts`, which a
  fresh CI checkout has never built. It is in the ESLint ignores because its
  triple-slash references trip `@typescript-eslint/triple-slash-reference`.
- **`components/icons.ts` is a closed registry because the font is a subset of
  it.** `iconFontHref()` asks Google Fonts for exactly those `icon_names`, so an
  icon drawn from outside the list has no glyph and renders as its own name in
  words — which reads as a typo in the copy rather than as a missing icon.
  `next/font/google` cannot host this: its catalogue excludes the icon fonts,
  checked by a failing `next build`.
- **`/api/places` is an allowlist and must stay one.** Three upstream calls are
  reachable, the autocomplete body is rebuilt from validated fields rather than
  forwarded, and the field mask is a server-side constant because it decides
  which SKU the call is billed at. Anything more general is a public,
  unauthenticated, billed relay for the whole Places API.
- **RN accessibility roles are not ARIA roles.** `role="text"` is WebKit-only,
  `summary` is not a role at all, and claiming `radiogroup` owes arrow keys and
  a roving `tabindex`. Use the real elements — `<fieldset>` with radios or
  checkboxes — and let the browser supply the keyboard model.

## Built so far

- **Brelly on the web.** `apps/web` is a Next.js 15 App Router app on the same
  `packages/core`, with real URLs for all eight screens — `/`, `/plans`,
  `/history`, `/plan/new`, `/plan/[id]`, `/routines`, `/settings`, `/account` —
  plus `/api/places`, the proxy that exists so no browser ever holds a Places
  key. Navigation is a sidebar at `>=768px` and a bottom bar below it, from one
  `DESTINATIONS` list. The palette is shared rather than copied: the tokens live
  in core and the web emits them as CSS custom properties at render time. What
  it deliberately does not have — notifications, the digest, calendar import and
  export, the widget, OTA, haptics — is hidden rather than half-built; see
  [round 39](#round-39--phase-3-of-the-web-migration-appsweb).
- **Over-the-air updates.** `expo-updates` on the `fingerprint` runtime-version
  policy, with `preview` and `production` channels wired to the same-named
  build profiles. `checkAutomatically` is left at its `ON_LOAD` default, so a
  cold start downloads in the background and runs the new bundle next launch;
  `useOtaUpdate` adds the two things that default misses — a foreground
  re-check (`ON_LOAD` fires once per process, so a backgrounded app never looks
  again) and telling the user, through `UpdateBanner` on Today and an "App
  updates" section in Settings. `describeOtaUpdateState` collapses
  `useUpdates()`' seven overlapping booleans into one ordered status.
  Publishing is `.github/workflows/ota-update.yml`, manually dispatched like
  the release pipeline beside it — see the fingerprint traps above for what it
  refuses to do and why.
- **Weather.** NEA service with 2hr nowcast / 24hr / 4-day tier selection
  (`getForecastForSlot`), nearest-NEA-area matching by coordinates against the
  live `area_metadata` lat/lng, temperature/humidity ranges where the tier
  carries them, and a `source: "error"` (fetch failed) distinct from
  `"unavailable"` (responded, no matching entry) so `WeatherBadge` can show
  "Couldn't load forecast · Retry" instead of "No forecast". Non-Singapore
  locations (round 19) use Open-Meteo instead — `weatherProvider.ts` derives
  `"nea"` vs `"openMeteo"` from coordinates once at slot creation, and
  `forecastProvider.ts`'s `getForecastForSlotByProvider` is the one place
  every caller branches on it. NEA stays the Singapore source; nothing about
  it changed.
  `getUpcomingForecast` powers the empty-state "weather nearby" preview.
- **Plans.** Google Places autocomplete + details (session-token billing),
  Google reverse geocoding for "Use my location" (`reverseGeocode`, with the
  on-device geocoder kept as an offline fallback — Apple's Singapore placemarks
  are frequently no more specific than "Singapore"),
  Zustand + MMKV store, `SlotForm` shared by the add/edit screens, swipe to
  mute or delete, and duplicate to another date via `CopyToDateAction` +
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
  undoable from the toast (`useDeleteSlotWithUndo`). The card's left swipe
  reveals Mute beside Delete — `useMuteSlotWithUndo` is the mute seam, and it
  is withheld on the archive, where there is no future alert to silence.
- **Routines.** A repeat is stored as a rule (`Routine`, `routineStore`) —
  any set of weekdays plus an optional end date — and materialised into
  ordinary slots a fortnight ahead (`planRoutineMaterialization`,
  `RoutineHorizonDays`), topped up on launch and on foreground by
  `useRoutineSync`. Every stop carries the `routineId` that made it, so editing,
  muting or deleting one day asks whether it means the day or the rule
  (`askEditScope`); "this day only" detaches the slot and records an exception,
  which is what stops the next top-up refilling it. The delete and mute
  prompts live in the seams (`useDeleteSlotWithUndo`, `useMuteSlotWithUndo`),
  so a swipe on a list asks the same question the form does; the save-scope
  prompt is still raised by `plan/[id].tsx` itself, since only that screen
  knows what was edited. Nothing downstream knows
  routines exist. A dedicated routines screen (`src/app/routines.tsx`, modal
  route) lists all rules with `describeRoutine` and exception counts.
- **Routing.** `(tabs)` group (Today, Plans, History, Settings) + root `Stack`
  with `plan/new`, `plan/[id]`, `routines` and `account-link` as modals.
  Settings moved from a modal reached via a header gear button to a tab of its
  own — see [round 18](#round-18--settings-becomes-a-tab).
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
- **Cloud sync & accounts.** All three stores (`itineraryStore`, `routineStore`,
  `settingsStore`) are backed by Firestore instead of MMKV `persist`:
  `signInAnonymously()` runs silently on first launch (no forced sign-in
  screen), a one-time local→cloud migration copies any pre-existing MMKV data
  up, and every store action keeps its old synchronous shape — `set()` first,
  a fire-and-forget Firestore write underneath it, `onSnapshot` keeping the
  store a live mirror of the cloud doc/collection. `useCloudBootstrap()`
  (mounted once in `_layout.tsx`) exposes the readiness flag that
  `index.tsx`/`plans.tsx`/`history.tsx`/`plan/[id].tsx`/`routines.tsx` gate a
  `<Skeleton>` on, and that `useRoutineSync` gates its mount-time
  materialisation pass on (see the traps above for why both matter). A
  "Back up your data" row in Settings (`src/app/account-link.tsx`) links the
  anonymous identity to Google, Apple, or email/password; linking to a
  brand-new account is free (the uid doesn't change), and linking to an
  account that already has data prompts to add the local plans/routines to it,
  landing the union of both once merged. `firestore.rules` scopes every
  document to `request.auth.uid` and validates field shapes per collection.
  Slots and routines stay per-document (not a whole-store blob) specifically
  so two devices editing concurrently merge rather than clobber. Real
  listener/offline/security-rule/multi-device behaviour needs the Firebase
  Local Emulator Suite or a real device — outside what `yarn test`'s fakes can
  honestly cover, so the outstanding manual QA lives in `PLAN.md`.
- **Widget (iOS).** A WidgetKit extension (`targets/widget/`, generated by
  `@bacons/apple-targets`) showing the next stop and its umbrella verdict on the
  home screen (small/medium) and lock screen (rectangular/inline). It reads a
  JSON snapshot the app writes into a shared App Group; `buildWidgetSnapshot`
  builds it from the same upcoming-stop forecasts the notification sync already
  fetches, and `writeWidgetSnapshot` publishes it at the end of every
  `runNotificationSync`. iOS-only by design — see
  [round 29](#round-29--the-widget-the-one-thing-appjson-couldnt-reach). The
  native half is verified on device, not by the gate; the two `appleTeamId` /
  App-Group setup steps are noted in `PLAN.md` and the widget traps above.

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
  (nearest _reporting_ station — the station list includes sensors absent from
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
  explicitly _not_ read as "no rain", so a network blip can't silently strip an
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
  it runs _at render on both tabs_ as well as on write — installs that predate
  this still have a hand-dragged order persisted in MMKV, and sorting only on
  write would leave it there forever. `SortableItineraryList`, `utils/reorder`
  and the store's `reorderSlots` were deleted; Today maps `ItineraryCard`
  directly. This also closed two accessibility items for free — the drag
  handle had no `accessibilityActions`, so a screen reader could not reorder
  at all.
- **Every mutation now reports success or failure**, via `saveWithFeedback` +
  `ToastHost`. Three things about this are worth knowing before touching it:
  - **The failure branch is real, not decorative.** Both stores are wrapped in
    zustand's `persist`, which calls `mmkvStorage.setItem` _synchronously_
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
    controller presented over the window, so a host at the root is _behind_
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
a "Show N past plans" toggle at the very _bottom_ of the Plans list — so a month
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
  appear in _both_ halves — morning in the archive, evening still ahead. All
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
  forecast". It does _not_ dim the card — everything on that screen is past, so
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
per-item status; what follows is what a future round needs to _know_.

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
  Places lookup the form uses, and events it can't resolve are _reported_
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
  a later sibling _within_ the field and did exactly the same thing one level
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
_"Rain matters for a park and not for a mall"_ — but only as a preference someone
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
  And because the coupling is on the _press_ and not in an effect, reopening an
  indoor stop whose alerts were deliberately re-enabled doesn't re-apply the
  default and quietly undo the choice on the next save. That is the one bug here
  that nothing on screen would have revealed, so it has its own test.
- **Absent means outdoor, and it is read through a function.**
  `resolveSlotKind` exists because the card, the form and the search index all
  have to agree about what an untagged slot is, and three copies of `?? "outdoor"`
  is three chances to disagree. Search indexes the _resolved_ kind for exactly
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
  decides _which slots exist_ and nothing else changed.
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
  is recorded _as well_ — a gap in the calendar means "not filled in yet", so
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
  a fresh one per render gave `cancel()` a _different_ timer from the one
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
  _await_ the prompt, so `await fireEvent.press(...)` and only then answering
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
  starting from today, each showing the day name and date number. Today's cell
  is distinguished with a primary border. The stop count is a notification-
  style badge overhanging the cell's top-right corner, not a third "N stops"
  line — the strip sits above the list it summarises, so height there is
  height taken from the list, and a badge inline beside the date read as
  crowded. The badge is a bare number, so each cell carries an
  `accessibilityLabel` ("Sat 8, 2 stops") and is `accessible` as one node; the
  digit alone reads as nonsense otherwise.
- **Routines screen** (`src/app/routines.tsx`) registered as a modal route.
  Lists all routines with `describeRoutine`, shows exception count, and has an
  empty state. Reachable from a repeat button in the Plans header.
- **Export backup** writes itinerary + routine store state to a JSON file via
  expo-file-system v57's `File` class (not the old `FileSystem.writeAsString`).
  The backup service uses `Paths.cache` and `shareAsync`.
  **`importBackup` exists but is not wired to anything** — Settings' Backup
  section has an "Export data" button and no import counterpart. (The
  `isImporting` flag in `settings.tsx` belongs to the _calendar_ sync, which is
  what made this look done. It was recorded here as "wired in Settings" until
  round 15 found otherwise.)
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

### Round 15 — the backup was quietly lossy

Found while reviewing `FIREBASE_MIGRATION.md`, not from a report — nothing on
screen would ever have shown either of these. Both are in `importBackup`,
which turned out never to have been called (see the correction above), so they
were latent rather than live; they would have shipped the moment an import
button was wired up, and the Firebase plan keeps `importBackup`.

- **Every restored stop lost its rain alert.** `exportBackup` wrote slots
  verbatim, notification handles included, and the import handed them straight
  to `restoreSlot` — which does not strip, because the stripping lived in the
  _other_ caller, `useDeleteSlotWithUndo`. See the trap above for what carrying
  the handle costs. Fixed by stripping on export _and_ on import (files written
  by earlier builds already carry the ids, and the import is the only place
  those can be cleaned up), with the knowledge moved into
  `stripNotificationHandles` so there is one place that knows what is
  device-local. `useDeleteSlotWithUndo` now calls it too — two call sites
  disagreeing is what caused this.
- **Importing a routine re-keyed it and dropped its exceptions.** The import
  called `addRoutine`, which mints a fresh id and resets `exceptions` to `[]` —
  correct for a new rule, wrong for one coming back. It type-checked because
  passing a variable (rather than an object literal) to an
  `Omit<Routine, "id" | "exceptions">` parameter skips excess-property
  checking, so the extra `id`/`exceptions` were silently overwritten by the
  spread. Two consequences: the imported slots still carried the _old_
  `routineId`, so `planRoutineMaterialization` read every upcoming stop as
  belonging to a rule that no longer existed and swept it; and the lost
  exceptions meant every day the user had deliberately deleted came back on the
  next top-up. New `restoreRoutine` mirrors `restoreSlot` — same id, same
  exceptions, replacing any routine already holding that id so importing twice
  restores rather than duplicates.
- **`backup.ts` had no tests at all.** It does now
  (`src/services/backup.test.ts`), including the round trip, a legacy file that
  still contains notification handles, and a double import. The in-memory
  `expo-file-system` double lets a test write a file, hand its uri to
  `importBackup`, and read back what `exportBackup` produced.
- **Testing.** 850 tests across 81 suites. One thing to know: the suite is
  meaningfully slower on a cold Jest cache (~34s vs ~13s warm), and
  `SlotForm.test.tsx` can exceed RNTL's 5s per-test timeout in that state while
  passing in 1.3s on its own. A single timeout there after a `--clear` or a
  fresh checkout is worth re-running before believing.

### Round 16 — off MMKV, onto Firestore

The largest change to ship in this repo: itinerary, routines and settings
moved from on-device MMKV (via Zustand `persist`) to Firestore, with anonymous
auth and optional account linking on top. Multi-device support was the actual
goal throughout — a lone JSON export/import (already shipped, still kept as
the manual/cross-account fallback) was not enough once two devices could share
an account. Tracked across six phases in `FIREBASE_MIGRATION.md`, which stays
on disk rather than being deleted — unlike a finished `PLAN.md` task, it's
cited by section name from dozens of comments across `src/`, so it now
functions as permanent design-rationale documentation rather than a scratch
plan. What follows is the condensed version, folded in per this file's usual
"move finished work out" convention; the outstanding manual QA moved to
`PLAN.md`.

- **Every store action kept its old synchronous shape.** `addSlot` still
  returns the new slot immediately; `set()` runs first for an instant local
  update, and a fire-and-forget Firestore write happens underneath it.
  `onSnapshot` listeners keep each store a live mirror of its cloud
  doc/collection, so no screen changed how it _reads_ data — only the loading
  state changed, see the skeleton point below. Firestore writes are
  per-document (`users/{uid}/slots/{slotId}`, `.../routines/{routineId}`), not
  a whole-store blob, specifically so two devices editing concurrently merge
  rather than overwrite each other; `addException`/`removeException` on a
  routine use `arrayUnion`/`arrayRemove` for the same reason.
- **No MMKV boot-time seed — a skeleton instead.** An earlier draft kept MMKV
  as a synchronous boot seed so the first frame had data; dropped, because a
  seed is a second source of truth that has to be kept fresh to stay safe, and
  a stale one is exactly what made the materialiser race (see the trap above)
  dangerous. `useCloudBootstrap()`'s readiness flag
  (`src/store/cloudSyncStore.ts`) gates a shared `<Skeleton>`
  (`src/components/Skeleton.tsx`) ahead of every screen's existing empty
  state, because without a seed a store starts at its Zustand defaults and an
  empty state with a CTA would otherwise render confidently before the first
  snapshot arrives. It waits on Keychain auth restore plus the first _cached_
  `onSnapshot` delivery, never the network — an offline cold boot still clears
  the skeleton and shows real plans from the Firestore cache.
- **The one-time local→cloud migration splits into an enqueue half and a
  confirm half, and boot only waits on the first.**
  `writeBatch().commit()` resolves on server ack, which a device that upgrades
  and first launches in airplane mode may never get — waiting on it would hang
  the skeleton forever. `localDataMigration.ts` enqueues the batched writes
  (chunked to 400, under Firestore's 500 cap — a single routine can produce
  ~260 archived slots/year) and attaches listeners without awaiting the
  commit; a uid-keyed MMKV flag
  (`brelly-migration-complete:{uid}`) is set only once the commit actually
  resolves, off the boot path, so a killed app retries next launch. Re-running
  is safe because ids are reused verbatim (see the IDs point below), making a
  retry a same-doc-id overwrite rather than a duplicate.
- **IDs come from `doc(collection(getFirestore(), path)).id`** — collision-proof
  and generated client-side with no round trip, replacing the duplicated
  `Math.random().toString(36)`-based `generateId()` that used to live in both
  `itineraryStore.ts` and `routineStore.ts`. Existing locally-persisted 7-char
  ids are valid Firestore doc ids as-is and are reused verbatim on migration.
  Routine-materialised slots are the one exception — see the deterministic-id
  trap above.
- **Account linking covers both directions of "join an existing account."**
  `src/app/account-link.tsx` (Google, Apple — required alongside Google per
  App Store guidelines — and email/password) calls `linkWithCredential` on the
  current anonymous user. Linking to a brand-new identity is free: the uid
  doesn't change, so every doc already under `users/{uid}/…` already belongs
  to the account. Linking to an identity that already has an account throws
  `auth/credential-already-in-use` — or, for an email/password credential,
  `auth/email-already-in-use`; Firebase spells the same situation differently
  per provider, and matching only the first is what broke the email flow (see
  [round 33](#round-33--the-emailpassword-flow-that-only-ever-worked-once-and-the-way-back-out)) —
  which is the signal, not an error, to run the merge: because the security rules block reading one uid's documents
  while authenticated as another, the merge is driven from the **local**
  Zustand state (never the frozen MMKV blobs), not a cloud-to-cloud copy. The
  user is prompted before anything merges (skipped only when the local
  snapshot is empty — nothing to offer), the anonymous uid's docs are deleted
  before the identity switch (they become unreachable the instant it happens),
  and on the far side any id collision with the target account's own docs
  mints a fresh id rather than overwriting — overwriting would silently
  destroy a plan that already lived there, the worst outcome a merge could
  produce. Settings never merge (a union of scalar preferences is meaningless;
  the joined account's settings win). `signOutOfAccount` is the way back out:
  it deletes nothing from the account, but it must tear the listeners down,
  clear the OS notification queue, empty the stores through `setState` rather
  than their actions, and set the migration flag for the new anonymous uid —
  see [round 33](#round-33--the-emailpassword-flow-that-only-ever-worked-once-and-the-way-back-out).
  The merge isn't atomic — it spans two
  auth identities — so the snapshot is persisted to MMKV before anything
  destructive happens and cleared only once the merge commits, letting
  `resumePendingMergeIfNeeded` finish an interrupted merge on next launch. One
  narrow crash window is accepted rather than further mitigated: a crash
  between the identity switch and the resumable snapshot's own completion has
  no credential left to resume the switch itself with.
- **`firestore.rules` scopes every document to `request.auth.uid` and now
  validates field shapes per collection** (round 16's own phase 6): required
  fields and their types for slots and routines, length caps on
  `label`/`location`/`notes`, enum checks (`neaRegion`, `kind`,
  `themePreference`, `rainLeadMinutes`), and an explicit rejection of the
  device-local fields (`notificationId`, `notificationLeadMinutes`,
  `digestNotificationId`) as a server-side backstop to the client-side
  stripping above. Settings' fields are all optional-if-present rather than
  required, unlike slots/routines: a slot or routine doc always starts life as
  a full-doc write, but settings' very first write for a brand-new install can
  be a single setter's partial merge onto a doc that doesn't exist yet, and
  requiring every field would reject it. The allow/deny paths against real
  data are now exercised automatically — see [round 17](#round-17--the-rules-check-stops-being-manual).
- **Testing follows the existing structural-fake pattern**, extended rather
  than replaced: `src/test/fakeFirestore.ts` fakes the modular functions in
  use (`getFirestore`, `collection`, `doc`, `onSnapshot`, `writeBatch`,
  `setDoc`, `deleteDoc`, plus `arrayUnion`/`arrayRemove` sentinels), never a
  chained API, because the installed SDK doesn't have one (see the trap
  above). `src/test/fakeAuth.ts` is a stateful double with an
  `existingAccounts` registry for simulating
  `auth/credential-already-in-use`. New pure logic — `groupSlotsIntoPlans`,
  `migrateSettingsDoc`, `materializedSlotId`, `resolveMergeWrites`'s
  collision resolution — has ordinary unit tests with no Firestore mocking,
  this repo's existing preference for keeping non-trivial logic in plain
  `src/utils/` functions.
- **What manual QA is still outstanding** (needs a real device/simulator, not
  reachable through the verification gate): offline add/edit/delete, offline
  cold boot, the local→cloud migration surviving a kill mid-commit, and the
  two-device materialisation race from phase 4; both account-linking
  requirements, kill-mid-merge resumption, and no re-migration into a joined
  account from phase 5. Tracked as open items in `PLAN.md` rather than left
  only in this paragraph. (The phase 6 rules check is no longer on this list —
  see [round 17](#round-17--the-rules-check-stops-being-manual).)
- **Testing.** 1049 tests across 100 suites.

### Round 17 — the rules check stops being manual

Round 16's phase 6 left one item on `PLAN.md`'s QA list that didn't actually
need a person: "exercising the allow/deny paths against real data needs the
emulator running interactively." That's true of a human clicking through the
emulator UI, but `@firebase/rules-unit-testing` drives the same emulator
programmatically — no device, no account, nothing a fake can fudge, since it
talks to the real rules engine.

- `firebase.json` (new, root) points the Firestore emulator at
  `firestore.rules`, fixed to port 8080. `demo-brelly` as the project id
  (rather than the real one) is what makes this fully local — the Firestore
  emulator treats any `demo-`-prefixed id as synthetic and never touches a
  real project, so this needed no credentials and nothing gitignored.
- `src/test/emulator/firestoreRules.emulator.test.ts` is the suite:
  owner-vs-non-owner-vs-unauthenticated read/write/delete, and one rejected
  case per validation branch in `firestore.rules` (missing required field,
  wrong type, out-of-enum value, over-length string, an out-of-range weekday,
  the device-local `notificationId`/`notificationLeadMinutes`/
  `digestNotificationId` keys). `testEnv.withSecurityRulesDisabled()` seeds
  fixture docs directly where a test needs one to already exist (e.g. to then
  assert a _different_ user can't read or delete it) — the only place rules
  are bypassed on purpose, since seeding through the rules themselves would
  make the seed itself part of what's under test.
- This suite is deliberately **not** part of `yarn test`: it needs a running
  emulator process, which `yarn test:emulator` (new script) provides via
  `firebase emulators:exec --only firestore`, and it needs its own
  `jest.emulator.config.js` — `jest.setup.js` mocks
  `@react-native-firebase/firestore` out entirely for every other test, which
  is exactly what this suite must _not_ have happen, so it can't share the
  main `jest` config in `package.json`. It also runs against the `firebase`
  web SDK, not `@react-native-firebase`, since `@firebase/rules-unit-testing`
  only speaks the web SDK's modular API — irrelevant to what's under test
  (the rules, not the client), but worth knowing if the two ever seem to
  disagree on an edge case.
- `PLAN.md`'s "Cloud sync" QA list has this item checked off now, with the
  rest of the list — real-device offline behaviour, the two-device
  materialisation race, account linking with real Google/Apple/email
  identities — still open exactly as round 16 left them. Nothing about this
  round touches those; they still need a person and real accounts.

### Round 18 — Settings becomes a tab

Settings was a `presentation: "modal"` screen reached by a gear button in the
Today and Plans headers. Moved to `src/app/(tabs)/settings.tsx`, a fourth
`NativeTabs.Trigger` in `appTabs.tsx` alongside Today/Plans/History.

- **The gear buttons are gone**, from both headers — a persistent tab is
  strictly more discoverable than a button duplicated across two screens, so
  keeping either would only add a second, redundant way in.
- **No more per-modal `ToastHost`.** The comment in `toastStore.ts` explains
  why `plan/new`, `plan/[id]` and `settings` used to each mount their own
  host: a modal is a real view controller presented over the window, so the
  root host (behind it) never draws. A tab has no such stacking problem — it
  sits in the same layer as Today/Plans/History, none of which mount their
  own host either — so Settings now relies on the root `<ToastHost root />`
  in `_layout.tsx` like every other tab. `settingsScreen.test.tsx` used to
  assert on rendered toast text for exactly this reason; it now asserts on
  `useToastStore.getState().toast`, matching how `todayScreen.test.tsx` and
  `plansScreen.test.tsx` already checked saves on their own screens.
- **The padding bug this surfaced.** Two `subSetting` rows — Calendar's
  "Add my plans to the calendar" and Backup's "Export data" — are the first
  element inside their `optionGroup`. Every other `subSetting` sits below a
  `switchRow`, whose own bottom padding is what visually separates it from
  the row before; `subSetting` itself carries no top padding because it was
  never designed to open a group. Those two buttons therefore sat flush
  against the group's rounded top edge with no gap at all. Fixed with a
  `firstInGroup` style (`paddingTop: Spacing.three`) applied only to those
  two rows, rather than adding top padding to `subSetting` generally — that
  would have doubled the gap everywhere a `subSetting` follows a `switchRow`.
- **`BottomTabInset` (50 on iOS) was stale.** Settings' Backup section is the
  screen most likely to hit the bottom of the scroll, and it surfaced that the
  constant no longer cleared the tab bar: content's last few points rendered
  _behind_ it. Confirmed on a real iOS 26.5 simulator (`xcrun simctl` install
  - `openurl` deep link to drive it, since there's no touch-input path
    available headlessly) that the gap between content and the pill's top edge
    was ~4pt — visually indistinguishable from zero. iOS 26's tab bar floats
    clear of the edge (the "Liquid Glass" pill) rather than docking flush like
    the tab bar `BottomTabInset` was originally tuned against in
    [round 14](#round-14--the-archive-becomes-a-tab), so it needs more
    clearance than a standard bar. Raised to 84 — measured against a
    screenshot, so it's a real number rather than a guess — which every tab
    shares via the one constant, so Today/Plans/History got the same fix for
    free.

### Round 19 — weather works outside Singapore

Brelly's weather was NEA-only, which is Singapore-only by construction —
blocking on the intended expansion into Southeast Asia. Open-Meteo (free, no
key, no documented rate limit, global coverage) is now the provider for
anywhere outside Singapore; NEA stays the Singapore source, since it's still
more accurate there (real stations, purpose-built nowcast — see the weather
API research this round is based on for the full comparison against
WeatherAPI.com/OpenWeatherMap/Tomorrow.io/Apple WeatherKit).

- **`weatherProvider.ts` (new)** derives `"nea"` vs `"openMeteo"` from
  coordinates via `isInSingapore` — a generous bounding box, deliberately
  separate from `neaRegions.ts`'s five region boxes, which answer a different
  question ("which NEA region", not "is this Singapore at all"). Stored once
  on `ItinerarySlot.provider` at creation/coordinate-change, exactly the way
  `neaRegion` already is; absent reads as `"nea"` so no store migration was
  needed, and `firestore.rules` got one additive `isValidSlot` line to match.
- **`openMeteo.ts` (new)** mirrors `weather.ts`'s fetch/normalize split, but
  the normalize step looks different: Open-Meteo's response is columnar
  (parallel `hourly.time[i]`/`hourly.weathercode[i]`/... arrays), so matching
  a slot to a reading is a nearest-index zip rather than NEA's
  nearest-area/period object lookup. Two source tags —
  `"openMeteoHourly"`/`"openMeteoDaily"`, split at the 7-day mark — carry the
  same confidence signal NEA's own `"4day"` tag already does.
  `wmoWeatherCode.ts` translates Open-Meteo's numeric condition codes into
  NEA-vocabulary strings so nothing downstream needed a second vocabulary
  (see the trap above).
- **`forecastProvider.ts` (new)** is the single dispatcher every
  forecast-fetching call site now goes through. Adding it surfaced a real bug
  in the existing code: `useRainNotificationScheduler` called NEA's fetcher
  directly, bypassing `useWeatherForSlot` — an overseas slot would have
  silently scheduled its rain alert off Singapore's `"central"` fallback
  forecast. Fixed as part of this round, not filed separately, since shipping
  overseas slots without the fix live would have shipped the bug too.
- **UV folded inline.** Open-Meteo returns `uv_index` in the same forecast
  call; NEA's is a separate island-wide endpoint (`useUvIndex`). `SlotForecast`
  gained an optional `uvIndex` field, and `ItineraryCard` now prefers
  `weather.uvIndex` over the (NEA-only, meaningless overseas) `useUvIndex()`
  value.
- **Search widened.** `geocoding.ts`'s `searchPlaces` dropped its
  `includedRegionCodes: ["sg"]` filter — the Singapore-centred
  `locationBias` circle stays, since it's a ranking preference, not a
  restriction, and still surfaces local results first for a search typed
  from Singapore.
- **Scope cuts, both explicit rather than silent.** Snow/sleet WMO codes fall
  back to a generic "Partly Cloudy" reading — the prioritized SEA markets are
  tropical, so `shouldNotifyForRain`/`derivePackingList`'s keyword lists
  weren't extended for it; a future non-tropical market needs that done
  properly. The "dry window" suggestion on the edit screen
  (`suggestDryWindow`, fed by NEA's `getUpcomingForecast`) has no Open-Meteo
  equivalent yet and is gated off for overseas slots rather than silently
  never firing for a reason no one could see.

### Round 20 — tap a week-strip cell to prefill a new plan's date

`WeekStrip`'s 7 day cells were display-only, even though `/plan/new` already
accepts a `date` param (the section-header "+" button on Plans has used it
since [round 12](#round-12--a-repeat-becomes-a-routine)) — reaching a specific
day beyond the strip's own week meant opening the form and hand-scrolling a
datetime picker instead.

- Each cell is now a `Pressable` wrapping the existing `ThemedView`/text/badge
  markup unchanged, so the "today cell has a border" test (which walks up
  from the `Text` node one level) still passes: the `Pressable` sits _outside_
  that parent, not between it and the text.
- `WeekStrip` takes a new required `onSelectDate(dateKey)` prop instead of
  reading `router` itself, matching how the component took `plans` as a prop
  rather than reading the store — `plans.tsx` wires it to the same
  `router.push({ pathname: "/plan/new", params: { date } })` call the
  section-header button already used.
- `accessibilityHint` ("Adds a plan on this day") was added alongside the
  existing `accessibilityLabel` (the stop-count sentence) — the label alone
  doesn't say what tapping does, and the hint doesn't need to repeat the stop
  count.

### Round 21 — one corner for how stale the forecast is

The card's top-right clock only took a _live_ reading's age. An outlook or an
offline one spelled itself out under the temperature instead, on the reasoning
that "just now" beside a clock icon would misstate a 4-day outlook. The word
was right; the placement wasn't.

- **Which tier answers is geography, not anything the reader can see.**
  `getForecastForSlot` hands anything more than a day out to NEA's 4-day
  outlook (`source: "4day"`), while `fetchOpenMeteoForecast` keeps the hourly
  tag for a full week (`HOURLY_CONFIDENCE_DAYS = 7`). So a Singapore stop
  tomorrow got "Outlook · 1h ago" buried under its temperature, and an
  overseas stop _further_ ahead got a tidy corner clock. Same card, same
  question, two different places to look — and in practice the buried one was
  always the Singapore plan.
- **`ForecastTimestamp` now takes every reading that has an age.** Freshness
  is gone from `WeatherBadge` entirely; its `metaRow` collapsed to the single
  temperature line it now holds. One line down the column to check for
  staleness, whichever API answered.
- **The clock icon still stands in for "Updated" only.** "Outlook ·" and
  "Offline · saved" ride beside the icon spelled out, because they say how far
  the reading is being stretched and that it came off disk — neither of which
  a clock face can carry. `freshnessRow` took `flexShrink: 0` so the longer
  strings claim their width from the time row rather than wrapping.
- **The spoken sentence moved with it.** `WeatherBadge`'s `accessibilityLabel`
  used to append freshness even for the live case it no longer rendered;
  `ForecastTimestamp` is now its own accessible node speaking the full
  `describeFreshness` string, so VoiceOver hears "Updated 4m ago" where the
  screen shows a clock and "4m ago".

### Round 22 — the first App Store submission, rejected by its own frameworks

Builds 5 and 6 finished green on EAS and `eas submit` still bounced, with
ITMS-90171 repeated once per framework: "the ... binary file is not permitted.
Your app cannot contain standalone executables or libraries."

- **The build status told us nothing; the artifact told us everything.**
  Downloading build 6's `.ipa` and running `file` over
  `Payload/brelly.app/Frameworks/` split it cleanly: 47 Mach-O dylibs and 24
  static `ar` archives. Every framework Apple named was in the static 24, and
  the pasted error list was simply truncated at 20. A static library cannot be
  loaded by dyld and has already been linked into the app binary, so its
  presence in the bundle was pure dead weight — all 24 held nothing but the
  binary, an `Info.plist` and a `_CodeSignature`, so dropping them loses
  nothing.
- **The culprit was our own Firebase plugin's phase, not CocoaPods'.**
  `Pods-brelly-frameworks.sh` embeds 38 frameworks, all of them correct. The
  other 33 came from `[RNFB] Embed Firebase SPM Frameworks`, which
  `withFirebaseSpmPostIntegrate.js` installs: 9 genuine Swift Package products
  (`Firebase*`, `GUL*`, `third-party-IsAppEncrypted`) and 24 CocoaPods static
  products it had no business touching, `Pods_brelly.framework` — the
  CocoaPods umbrella, unambiguously not a Swift Package — among them. See the
  trap above for the mechanism.
- **The guard is spliced in, not a rewrite.** Replacing the whole upstream
  script would silently revert any future RNFirebase fix, so the plugin
  `sub`s a `file -b` check in after one literal line of it and raises
  `Pod::Informative` when that line is gone. A test greps the real
  `firebase_spm.rb` for the same literal, so an upstream rewrite fails at
  `yarn test` rather than as a rejected submission weeks later.
- **Unidentifiable binaries are embedded, not dropped.** The asymmetry is
  deliberate: a spare framework is a validation warning, while dropping one
  the app really links is a dyld crash at launch.
- **The CI failure that started this was unrelated and already fixed.** The
  one red `iOS Release` run died on `An Expo user account is required to
proceed` — it ran twelve minutes before the `EXPO_TOKEN` secret existed. Not
  a credentials problem, and not the reason the submission failed.

### Round 23 — a run's result reaches a phone instead of a browser tab

Waiting on the Actions page for a green tick is not a workflow. Telegram was
the pick over email or a GitHub mobile push because a bot is free, needs no
account beyond the one already there, and delivers in seconds.

- **One reusable workflow, not a copied step.** `notify-telegram.yml` is a
  `workflow_call` workflow that both `ci.yml` and `ios-release.yml` end with.
  Inside a reusable workflow `github.workflow` resolves to the _caller's_
  name, so one copy labels every message correctly without being told which
  workflow it is reporting on.
- **`if: always()` is the whole point.** A job with `needs` defaults to
  running only when those needs succeeded, which would have made the notifier
  silent in exactly the case worth a notification.
- **A skipped need is not a failure.** `conventions` only runs on a
  `pull_request`, so on a push to `main` it reports `skipped`. The status
  expression checks for `failure` and `cancelled` explicitly and treats
  everything else as success, rather than requiring every need to be
  `success`.
- **Missing secrets skip, they do not fail.** A PR from a fork gets no
  secrets, and this repo is public. The step exits 0 with a note when
  `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is empty, so an outside
  contributor's PR is not red for a reason that is none of their business.
- **`github.ref_name` is the wrong branch on a PR.** It resolves to
  `17/merge`. The message uses `github.head_ref || github.ref_name` so a PR
  reports its own branch and a push still reports `main`.

### Round 24 — the release pipeline gets far enough to fail somewhere new

Three dispatches, three unrelated failures, none of which a local build could
have shown. Worth listing together, because the shape repeats: every one was
the runner having less than a working copy does.

- **`EXPO_TOKEN` did not exist yet.** The first run died on `An Expo user
account is required to proceed` twelve minutes before the secret was created
  (`created_at` and `updated_at` both say so). `expo/expo-github-action` does
  not fail on an empty token; it just does not authenticate.
- **ITMS-90171 came from a build that succeeded.** Rejected at `eas submit`,
  not at build time — see round 22.
- **`GoogleService-Info.plist` was missing on the runner.** See the trap above
  for why `app.config.js` does not cover this case.

Two things follow from that.

- **A green build status says nothing about a shippable artifact.** The one
  build that reached App Store validation had already been marked `finished`.
  Check the `.ipa`, not the badge.
- **The cheap gate is a tracked-files-only tree.** `git archive` plus
  `expo config --type introspect` reproduces the runner's view in seconds and
  would have caught the plist immediately. It cannot catch a repo-settings
  problem like the missing token, and it cannot catch anything that only
  appears in a real archive — so it is a habit, not a guarantee.

The actions were also pinned forward to `checkout@v7`, `setup-node@v7` and
`expo-github-action@v9`, which are the first majors on `node24`; the `v4`/`v8`
line runs on `node20` and GitHub now forces and warns about it.

### Round 25 — a fix can ship without the App Store

Everything in this app that isn't native is JavaScript, and until now a typo in
a forecast string took the same two-day round trip through review as a new
native module. `expo-updates` closes that, and the interesting part is not the
install — it is deciding, mechanically, which changes are allowed through it.

The `fingerprint` runtime-version policy is that decision. It hashes
everything that could affect the native runtime and refuses to match an update
against a build whose hash differs, which is exactly the question "does this
need a rebuild?" answered by something other than memory. The cost is real —
any new native dependency now means a build before an update — and it is the
right cost, because the failure it replaces is invisible: EAS publishes an
update under an unmatched runtime version without complaint, and it reaches
nobody.

Two things came out of building it that were not obvious going in.

- **The `app.config.js` plist bridge does not break fingerprinting**, though it
  looks like it should. The builder and a CI runner read
  `GoogleService-Info.plist` from different absolute paths, and the evaluated
  app config is part of the hash — but `@expo/fingerprint` records external
  config files as `expoConfigExternalFile:contentsOnly`, so only the bytes
  count. Checked by computing the fingerprint twice rather than by reading the
  docs, which do not say this. What it does create is a coupling: the plist on
  EAS and the one in the repo secret have to stay identical.
- **A silent update is worse than no update.** The default behaviour — download
  in the background, swap on some later cold start — means a downloaded fix can
  sit unused for days while the user looks at the bug it repairs, and there is
  nothing on screen to say so. `UpdateBanner` renders only when a bundle is
  genuinely staged and is dismissible, since nothing about it is urgent; the
  Settings section says what is actually true on the device, in the same spirit
  as "Scheduled right now" (round 9) saying what the OS has queued rather than
  what the app intends.

The workflow is manual, matching `ios-release.yml`. Publishing from every merge
would make a deliberate update indistinguishable from an incidental one, and
the fingerprint guard is meant to be a second opinion rather than the only one.

### Round 26 — the gap warning stops firing on flights

`detectScheduleConflicts` compares the distance between two stops against
`MAX_PLAUSIBLE_SPEED_KMH = 60`, a figure chosen when every stop was in
Singapore and the question was "Changi to Jurong in ten minutes?". Since round
19 an itinerary can cross an ocean, and then the check fires on every single
leg — with a banner the user can do nothing about, because they are on a plane.

The fix is a suppression, not a bigger number. Raising the speed limit to
something a plane could hit would blind the check to the case it was written
for; the leg has to be _classified_ first, and only ground legs measured.

Two signals do the classifying, and the interesting part is why neither works
alone.

- **Different country codes** is the direct evidence, and `countryCode` is a new
  optional slot field read straight off the Places lookup's `country` address
  component. But optional means it is missing on every stop made before this
  round, on every calendar import, and on "Use my location" — and a missing code
  has to read as _unknown_, never as `"SG"`. Defaulting it to Singapore is the
  same assumption that caused the bug.
- **A `GROUND_TRANSPORT_LIMIT_KM = 500` ceiling** covers those unknowns, and
  also covers what a country code cannot describe at all: a domestic flight,
  where both stops honestly agree on `"US"` and are still 4,000 km apart.

`overlap` is untouched. Two stops booked over each other are double-booked
wherever they are, and that check never asked how you get between them.

Two things worth knowing if this is picked up again:

- **The country came free.** `getPlaceDetails`'s field mask is a billing
  decision as much as a data one — see the trap above. `addressComponents` is on
  the same Place Details Essentials SKU as the four fields already requested, so
  this added a field without adding a cent. That was checked against Google's
  SKU table, and the component's shape against a live response: the country
  entry is `{ longText: "Singapore", shortText: "SG", types: ["country",
"political"] }`, so `longText` is the country's _name_ and only `shortText`
  is the code.
- **Routines carry it too.** A rule stores one location, so `Routine` grew the
  same optional field and `routineSlotForDate` passes it down. Without that,
  a routine's stops would have been the only ones in the app permanently
  unknown, and every leg to one would have fallen back to the distance ceiling.

### Round 27 — a toolchain upgrade breaks the build, and blames SwiftUI

Nothing changed in the repo. Xcode moved from 26.5 to 26.6, and the local iOS
build stopped linking with `cannot link directly with 'SwiftUICore' because
product being built is not an allowed client of it`.

The error is a good example of a symptom pointing away from its cause. Grepping
the repo for SwiftUICore finds nothing; so does `otool -l` over every prebuilt
binary in `Pods/`. The one place the string appears is inside
`ExpoModulesCore.xcframework`'s `.swiftinterface` — a text file that only gets
compiled when the binary `.swiftmodule` beside it cannot be loaded, which is
exactly what a compiler version bump causes. Expo built SDK 57's precompiled
modules with Swift 6.3.1; Xcode 26.6 ships 6.3.3. Rebuilding that interface
drags `SwiftUICore` in as a direct dependency of every client, and Apple's
`.tbd` only permits `SwiftUI` to link it.

Compiling a one-line file that imports the framework is what turned an
inference into a fact — `swiftc` says `this SDK is not supported by the
compiler` and names both versions, where the linker only complains about the
downstream consequence. Worth reaching for whenever a prebuilt binary is in the
picture: the linker sees the last step, not the first.

The fix is `ios.usePrecompiledModules: false`, which trades build time for not
depending on a version match Expo makes no promise about. It is set globally
rather than only for local builds, so EAS and this machine keep compiling the
same thing — the alternative saves CI minutes and reintroduces exactly the
class of local/EAS divergence that round 12 and the RNFirebase `post_integrate`
plugin were about.

One self-inflicted detour is worth recording, since the first fix attempt
looked like a new failure: `ios/build/` holds `pod install`'s codegen output,
so clearing it before rebuilding produced a missing `NitroModulesSpec.h` that
had nothing to do with the change. Both this and the SwiftUICore chain are in
the traps section.

### Round 28 — one location permission for the whole app

The last outright bug in `UX.md`: grant location on Plans and Today carried on
asking for it. The cause is a fact about the navigator rather than about the
permission — native tabs keep every screen mounted, so `useNearbyForecast`'s
component-local `useState` existed twice, and the OS answer reached whichever
copy had asked for it. Today mounts first, reads "not granted", and its effect
deps never change again, so it never looks a second time.

Three symptoms, one cause, which is why `UX.md` filed them as one item: the
per-tab grant, the onboarding primer calling `expo-location` directly and
discarding the result, and "Open Settings" leading somewhere that changed
nothing until the app was killed. Lifting the state into `deviceLocationStore`
fixes the first, routing the primer through the store's `request()` fixes the
second, and an `AppState` `"active"` re-read — the same move
`useNotificationPermission` already makes, for the same reason — fixes the
third.

The re-read is scoped to `denied` and `unavailable`. Adding `unprompted` looks
harmless and is wrong: iOS doesn't list an app under Location Services until it
has asked once, so there is nothing a user could have changed while we were
backgrounded, and polling for it on every foreground would be work that can
never find anything.

Two problems appeared only because the state became shared, and both are worth
knowing before anything else moves into a store this way.

- **Every consumer syncs in the same commit.** Two mounted tabs meant two
  `getForegroundPermissionsAsync` calls where the old code's duplication at
  least kept them in separate components. `sync()` returns the in-flight
  promise instead, so N consumers cost one round trip — but only while that
  promise is still current, or a read superseded by a grant would be handed to
  a later caller and silently swallow its request.
- **A stale read can overwrite a fresh answer.** The foreground listener fires
  a read while the permission is denied; the user taps "Show weather near me"
  and grants it; the read comes back with the denial it was sent to fetch and
  writes it over the grant. Nothing about the per-screen version could produce
  this, because nothing else wrote to that state. Every write now carries a
  generation and a superseded one is dropped.

The regression test the item asked for — two consumers of the hook in one
`renderHook` — is what makes the original bug expressible at all. The suite was
green through the whole life of the bug because no test ever mounted the hook
twice.

### Round 29 — the widget, the one thing app.json couldn't reach

The last open item on the original backlog, and the only one that needed a
second native process. A widget renders in a WidgetKit extension with its own
bundle id and entitlement, sharing nothing with the app but an App Group — none
of which `app.json` can express and none of which Jest can mount. The design
question came first: what does one glance say, and what writes it.

- **What it says: the next stop and its umbrella verdict.** The same one
  question the whole app answers (`describeUmbrella`), at pill length, for the
  soonest upcoming stop. `buildWidgetSnapshot` derives it and carries a real
  third state the app already distinguishes — `umbrella: null` when the forecast
  couldn't load, so the widget says "No forecast" rather than a confident,
  wrong "Clear". The home-screen families get the full glance with the umbrella
  colours from `theme.ts`; the lock-screen accessory families get two
  monochrome lines, because the system renders those desaturated anyway.
- **What writes it: the notification sync, which already runs on the right
  schedule.** `runNotificationSync` re-reads every upcoming stop's forecast on
  mount and on every foreground — the only thing in the app that does — so the
  snapshot write is one call at the end of that pass, reusing forecasts already
  fetched. No new schedule, no extra network, and the widget is exactly as fresh
  as the app.
- **The target is generated, not committed.** `@bacons/apple-targets`
  (decided over a hand-rolled pbxproj plugin — it ships `ExtensionStorage` for
  the App-Group write and the target-creation the three existing local plugins
  would each have had to grow) reads `targets/widget/` on prebuild. The Swift
  decoder mirrors the TS snapshot type by hand, since the two processes share
  only JSON. See the widget traps under "read this before writing code here"
  for the four-places-must-agree App Group, the `appleTeamId` the build needs,
  and why the gate can't verify any of the native half.
- **Scoped to iOS.** The backlog named an Android `AppWidgetProvider` too, but
  "lock-screen glance" is an iOS phrase — Android has no third-party
  lock-screen widgets, only home-screen ones — so the Android widget is
  deferred rather than built. The JS seam (`buildWidgetSnapshot`) is
  platform-neutral and would feed an Android provider unchanged if one is added.
- **Testing.** The JS half is fully covered — `widgetSnapshot` (the next-stop
  reduction, each verdict state, the unknown-forecast case) and `widgetBridge`
  (the iOS write, the Android no-op, the swallowed failure), with
  `@bacons/apple-targets` faked in `__mocks__/@bacons/apple-targets.js` the same
  way the other native modules are. 1233 tests across 113 suites.

### Round 30 — the floating time capsule, and a tab bar the docs lied about

Two `UX.md` items, one clean and one that turned out to rest on a false premise.

- **The pickers now have a pinned height, not just a width.** Typing in the
  Label field made the Starts/Ends capsules drift up over their captions. Same
  root cause the width tokens already document: the `@expo/ui` `DateTimePicker`
  is a SwiftUI host that reports *no intrinsic size* to Yoga — width was
  hand-set, height was not, so the box had no stable height and the capsule
  floated, creeping up on every relayout (a Label keystroke re-renders the whole
  form). `DateTimePickerHeight = 40` now sits beside the width tokens in
  `shouldStackDateTimeFields.ts` and is applied to all three pickers'
  boxes — `SlotForm`'s date/time, `RepeatField`'s end-date (which had a stray
  hardcoded `40`), and `CopyToDateAction`'s (which had no height at all) — so
  none can regress the float on its own. The Jest picker mock dropped `style`,
  which is why this was untestable; it now forwards it and `SlotForm.test.tsx`
  asserts the height, the same silent-regression guard `themeVariant` already
  needed.

- **The Liquid Glass tab bar: the plan's fix was a no-op on the OS it
  targeted.** `UX.md` said to opt the bar out of iOS 26 Liquid Glass with
  `blurEffect="none"` + `disableTransparentOnScrollEdge` + `shadowColor`,
  "verified against the v57 native-tabs docs." The v57 docs say the opposite,
  verbatim: *"The `backgroundColor`, `blurEffect`, `shadowColor`, and
  `disableTransparentOnScrollEdge` props affect the iOS tab bar only on iOS 18
  and earlier"* — on iOS 26 the system derives the bar from the content behind
  it and those props do nothing. Exactly the "typechecks and is still wrong"
  trap `AGENTS.md` opens with. There is no per-bar JS lever for opacity on 26.
  The fix turned out to be **two parts, and the flag alone is not enough** —
  which the first attempt got wrong, shipping only the flag and finding the bar
  still bled through after a rebuild:

  1. `ios.infoPlist.UIDesignRequiresCompatibility: true` in `app.json` opts the
     *whole* app out of the iOS 26 redesign, forcing iOS 18-style rendering.
     This is a native change: it only reaches the app through `expo prebuild`
     (the `ios/` dir is gitignored/generated) *and* a fresh native build — a JS
     reload can't pick up an `Info.plist` baked into the binary.
  2. The flag alone doesn't make the bar opaque — an iOS 18 tab bar still
     defaults to a translucent blur that content shows through when it scrolls
     underneath. `blurEffect="none"`, `disableTransparentOnScrollEdge` and
     `shadowColor={colors.border}` (a hairline separator) on `NativeTabs` in
     `appTabs.tsx` are what make it opaque — and these are the very props the
     v57 docs call no-ops on iOS 26. That is not a contradiction: with the flag
     forcing iOS 18 mode, "iOS 18 and earlier" now describes the running bar, so
     they apply. Flag without props → still translucent; props without flag →
     no-ops on 26. Both are required.

  Caveats worth knowing — the flag opts the *whole* app out of the redesign
  (bars, sheets, system chrome), not just the tab bar, and Apple has signalled
  it's a temporary compatibility aid slated for removal in a future Xcode.
  `app.json` can't carry a comment, so a test in `app.config.test.js` asserts
  the flag is present and survives the config merge, since a silent removal
  turns the `appTabs.tsx` props back into no-ops and the bleed-through returns
  with a green suite.

### Round 31 — the widget gets the plan card's skin, and two bugs under it

Making the home-screen widget look like a plan card surfaced two things that had
never actually worked on a device.

- **The colour assets were writing empty — the config keys were wrong.**
  `expo-target.config.js` declared its colours as
  `umbrellaRain: { color, darkColor }`, matching the `@bacons/apple-targets`
  JSDoc `@example`. The JSDoc lies. The plugin's *type* is
  `DynamicColor = { light: string; dark?: string }` and `with-widget.js` reads
  `color.light` / `color.dark` — so `{ color, darkColor }` gave both `undefined`
  and the plugin wrote `{ "colors": [] }` into every `.colorset`. A missing named
  colour renders as the widget's default white, which is why a "fresh build" came
  up white and the umbrella accent tints (`Color("umbrellaRain")`) had silently
  never shown either. The keys are `light` / `dark` now. This only bites through
  `expo prebuild` + a native build — the `.colorset/Contents.json` files are
  generated (gitignored), so a JS reload can't fix it, and the exact
  "typechecks and is still wrong" trap: the wrong shape typed fine against
  `Record<string, string | DynamicColor>` because the object was assignable to
  neither arm cleanly yet TS let it through the union.

- **The next stop never reached the widget on a cold start.** The store hydrates
  from Firestore (`useCloudBootstrap`'s `onSnapshot`) *after* the root mounts,
  and `useNotificationSync` only synced on mount and on foreground. The mount
  sync raced hydration and ran against `plans: []`, publishing an empty glance;
  nothing re-published until the app was backgrounded and refocused. The hook now
  also re-syncs, debounced (300ms), whenever a *structural* plan signature
  (`slot.id:slot.startTime` joined) changes — so hydration and any add/remove/
  re-time gets the real glance out, while a label or mute-toggle keystroke does
  not trigger a forecast fetch. `getForecastForSlot` has no local cache and hits
  island-wide NEA endpoints, which is why the signature is structural and the
  sync is debounced rather than keyed on the whole `plans` array.

- **What the widget draws now.** `cardBackground` (the app's `backgroundElement`,
  the violet a plan card sits on) fills the home-screen families; the lock-screen
  (accessory) families stay `Color.clear` because the system tints them. A real
  rain/sun verdict also earns the card's two at-a-glance marks, rebuilt in the
  `containerBackground` so the system clips them to the widget's rounded corners
  the way `ItineraryCard`'s `overflow: "hidden"` clips its own: a 4pt
  verdict-tinted bar down the leading edge, and the verdict's SF Symbol as a
  faint (0.14) watermark bleeding off the bottom-right. A clear stop or a missing
  forecast draws neither, matching the card (`decoration(for:)` returns nil).

### Round 32 — a swipe can mute, and every delete asks the same question

`notificationsMuted` was readable from a list and changeable only from the edit
form: the card drew the bell-slash, and turning it off meant opening the stop,
scrolling to a switch and saving. The left swipe now reveals **Mute** beside
Delete.

- **The mute is a seam, not a card-level toggle.** `useMuteSlotWithUndo` sits
  beside `useDeleteSlotWithUndo` and does what a mute actually costs: cancel the
  scheduled alert and clear `notificationId`/`notificationLeadMinutes`
  (`clearedNotificationHandles`), because an id left behind reads as "already
  scheduled" forever — `planNotificationResync` takes `!!notificationId` at its
  word. Unmuting re-schedules through `useRainNotificationScheduler`, which
  re-reads the forecast rather than trusting the one the old alert was built on.
  The card takes a callback rather than the hook, for the same reason `onDelete`
  is one: the card knows the stop but not the day it is filed under.

- **A routine's stop can't take a silent per-day flag**, which is what makes
  this more than a switch. Rule 4 of `planRoutineMaterialization` compares
  `notificationsMuted` against the rule and replaces any slot that disagrees, so
  a quiet mute would vanish at the next top-up. Muting one therefore raises the
  same `askEditScope` question the edit form asks: *series* moves the rule
  (`updateRoutine` + `materializeRoutines`, which rewrites every upcoming day
  and re-schedules on the way), *day* detaches the stop first (`addException` +
  `routineId: undefined`) so nothing may rewrite it afterwards.

- **The scope prompt moved into the delete seam too.** It used to live in
  `plan/[id].tsx`, so the same gesture meant two different things depending on
  where it was made: the edit screen asked, and the swipe on a list quietly took
  the this-day reading. `useDeleteSlotWithUndo` owns the prompt now and
  `handleDelete` is down to awaiting it and navigating. That is a deliberate
  behaviour change — swipe-deleting a routine's stop asks a question it did not
  use to ask. It also put "Delete all future days" one swipe and one mis-tap
  from a standing rule, so that branch gained the undo it never had:
  `restoreRoutine` puts the rule back under its own id (a fresh one would orphan
  every stop it ever made) with `exceptions` intact, and a re-materialisation
  refills the days the sweep took.

- **An awaited prompt makes the slot in your hand stale, and the stale field is
  the one that matters.** Both seams capture `slot` when the swipe is pressed
  and then park on `askEditScope` for as long as the user takes to answer.
  `notificationId` is exactly what gets written in that window —
  `runNotificationSync` stamps one on after its own awaited forecast fetch — so
  cancelling the captured copy's id cancels nothing while the update clears the
  real one. The result is an alert nothing can ever reach again, because every
  cleanup path finds alerts through `!!slot.notificationId`. Both seams re-read
  the slot from the store after the answer and cancel *that* one.
  `useRainNotificationScheduler` is hardened from the other side for the same
  reason: once its fetch resolves it re-checks the slot, and if the stop has
  since been muted, deleted or re-keyed it cancels the alert it just scheduled
  rather than dropping the handle on the floor.

- **The exception is recorded only once the detach has happened.** Ordering the
  two the other way round leaves the one state nothing recovers from: an
  exception with no detached slot behind it takes the day out of the routine's
  occurrences, so the next top-up reads the stop as unwanted and sweeps the
  thing the user only meant to mute. An `updateSlot` that finds nothing now
  throws rather than reporting a success the toast would offer to undo.

- **The mute's undo is offered on a one-off only.** The routine paths were asked
  about before anything happened, and the day one detached the stop on the way
  through — an "undo" that silently re-attached it would be a third answer to a
  question that had two. Both stay reversible by the gesture that caused them,
  which a delete never is. Undoing an *unmute* cancels the alert that unmute
  scheduled by reading the id off the store at press time, not off the slot the
  toast's handler closed over: the scheduler is fire-and-forget, so the id
  arrives after the toast does.

- **Mute is the inner action and is withheld on the archive.** Delete keeps the
  far edge it has always had — muscle memory for a destructive action should not
  move because a second one was added beside it — and the reversible one takes
  the shorter swipe. History passes no handler, because a stop that has ended
  has no alert left to silence. VoiceOver can't perform the swipe at all, so
  both actions are also `accessibilityActions` on the card, in the same order
  the panel puts them in: the rotor opens on the first entry, and that should
  not be the destructive one.

- **Two things the second action broke quietly.** `rightThreshold` was an
  explicit half-an-action, which stayed 44 while the panel grew to 176 — a
  quarter-length nudge latched the whole thing open on Today and Plans but not
  on History. It is gone; the library's default is half the *measured* panel,
  which is the only version that can be right on both. And both buttons now
  `close()` the row before running: Delete used to get away with leaving it open
  because the card always went with it, but a cancelled routine prompt leaves
  the panel standing over a stop nothing happened to — and the next tap on that
  card is swallowed closing the row rather than opening the stop. The accessible
  name for Mute opens with the word on the button ("Mute — turn rain alerts
  off"), or Voice Control's "tap Mute" matches nothing.

- **The archive is never asked about.** A materialised stop keeps its
  `routineId` after it has happened, so folding the prompt into the seam quietly
  put "delete all future days" on History's swipe — a live rule destroyed from
  the one screen that only holds a record of what already happened. A stop whose
  end time has passed skips the question entirely and deletes that one archived
  day, which is what it always did. Rule 1 of the materialiser is the same
  reasoning from the other end: nothing before today is ever touched, so there
  is no top-up that could put the day back and no rule-level reading to choose.

- **Two test-environment globals had to be admitted to.** Closing the row from a
  test needs `_WORKLET` and `ReduceMotion` — see the traps at the top of this
  file, along with the `act()` landmine that turned a broken assertion into five
  unrelated failures three tests further down. `close()` itself is *unobservable*
  under those globals — `runOnUI` and `withSpring` are identity functions in the
  stand-in — so `ItineraryCard.test.tsx` mocks `ReanimatedSwipeable` locally and
  hands `renderRightActions` a spy. Without it, deleting both `close()` calls
  passes the whole suite; the screens keep exercising the real component.

### Round 36 — a selected chip and an unselected one were the same colour

Reported against the Edit plan form in dark mode: the Indoor/Outdoor pair looked
identical, so the form did not say which one it had. It was measurable, not a
matter of taste — the selected chip was `backgroundSelected` on a
`backgroundElement` neighbour, **1.26:1**, and `fontWeight: "700"` on the label
was carrying the entire selection state on its own.

**Light had the same bug, at 1.19:1.** It was only ever reported in dark, but
this is the opposite of the round-11 dark-surfaces call, where light surfaces
held an edge that dark ones did not: here nothing separates the two chips in
either theme except the weight. Both were fixed.

**The fix is `primary`, not a wider neutral step.** Nudging
`backgroundSelected` further from `backgroundElement` is the change that looks
smaller and is not: that token is also every pressed state in the app
(`ItineraryCard`, the location suggestion rows, the Android tab ripple), and a
press flash sized to be unmistakable is a press flash that reads as a
selection. Selection and pressed-ness are different states and now use
different colours — `primary` fills the chosen chip, `onPrimary` takes its
label. 6.30:1 against the unselected chip in dark and 5.64:1 in light for the
fill; 9.00:1 and 6.84:1 for the label on it. Bold stays, on top of the fill
rather than instead of it.

**Four places, because it was one idiom copied four times.** The reported
Indoor/Outdoor chips in `SlotForm`, the Repeat / weekday / Ends chips in
`RepeatField` right above them, and both of Settings' radiogroups — the
Appearance rows and the shared `choiceRow` behind lead time and quiet hours.
Fixing only the reported one would have left the app with two contradictory
answers to "which one is picked".

**The test asserts the ratio, not the token.** `src/test/contrast.ts` is new —
WCAG luminance and contrast, excluded from coverage like everything under
`src/test/`. `expect(contrastRatio(selectedFill, unselectedFill)) > 3` fails on
the old code and passes on the new; `expect(...).toBe(theme.primary)` would have
passed just as happily on `backgroundSelected`, which is exactly the assertion
that let this ship. Both themes are parameterised, since only one of them was
reported.

### Round 37 — the duplicate section had no grouping, only gaps

Same screen as round 36 and reported straight after it. `CopyToDateAction` put
a flat `Spacing.two` between its caption, its picker and its Duplicate button:
three rows at one interval, so nothing in the layout said the first two are a
field and the third acts on it. The caption-to-picker gap was also 8 where
`SlotForm`'s `field` is 4 everywhere else, and this component renders *inside*
that form.

**A ladder, not a single value.** `Spacing.one` within the field,
`Spacing.three` to the button, `Spacing.four` (the form's own container gap) on
to Delete plan. The rule it leaves behind: gaps carry grouping, so a section
whose gaps are all equal has told the reader nothing, no matter which value it
picked.

**Delete plan was deliberately not touched**, and the reason is worth writing
down because it looks like the worst gap on the screen. It measures ~32 against
the 24 it is given, because the button's `paddingVertical` sits inside a row
with no background — an unfilled button's padding reads as gap. Shrinking it to
make the number match costs a tap target already at 40pt, under the 44 iOS
wants, and the extra distance in front of a destructive action is wanted anyway.

**Every gap in this section measures ~7 larger than its token**, which will
mislead the next person who takes a ruler to a screenshot. `DateTimePickerHeight`
pins the picker box at 40 because the SwiftUI host reports no intrinsic height
(round 5), the date capsule inside it is ~25, and SwiftUI centres it — so there
is ~7.5 of dead space above and below the visible chip that belongs to no gap.
Don't subtract it from the tokens to compensate.

`CopyToDateAction.test.tsx` is new — the component had no test of its own and
was only ever covered through `plan/[id].tsx`. It asserts the *ladder*
(`fieldGap < sectionGap`) rather than only the two literals, so a future flat
gap fails whichever value it flattens to.

## Shipped from the feature-idea list

The feature ideas were derived from what was already built — each named the seam
it hung off. These are the ones that shipped, with how the build differed from
the sketch. The open ones live in `PLAN.md`.

### Deeper weather

- **Wind + freshness on the slot card.** `TwentyFourHrForecast.general.wind`
  and `updatedTimestamp` were parsed into our types and then never read.
  _Freshness stayed; wind came back off the card — it never fed the umbrella
  verdict and it was the reading that pushed the meta line into wrapping.
  `SlotForecast.wind` is still parsed, and `formatWind` was deleted with it._
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
  _Built manually rather than from Places types, and as an input to the
  existing mute rather than a second suppression beside it — see
  [round 11](#round-11--a-stop-says-whether-its-under-a-roof).
  The persisted-data note turned out not to bite: an optional field with a
  default is what the two before it did too._
- **Now / next highlighting on Today.** The Today list rendered every slot
  identically regardless of the clock.
  _Done with the `findCurrentOrNextSlot` that already existed — it was
  being computed to anchor the live readings and thrown away. The card
  takes an outline rather than a fill, and `describeSlotTiming` puts "Now"
  or "in 40 min" ahead of the clock times on every card._

### Data lifecycle

- **Undo delete.** Deletes were immediate and permanent. `cancelAndDeleteSlot`
  was already the single choke point for every delete site, so an undo buffer
  had exactly one seam to thread through — including re-scheduling the
  notification it cancelled.
  _Done as predicted, and it also removed the edit screen's confirmation
  dialog — see [round 9](#round-9--the-backlog-minus-the-one-thing-that-needs-xcode).
  No buffer was needed: the deleted slot is closed over by the toast's action,
  and `restoreSlot` puts it back under its own id._

### Store schema versioning — resolved in round 13, superseded in round 16

`kind` shipped without it (round 11), as `notificationsMuted` and
`notificationLeadMinutes` did before it: an **optional** field whose absence has
a defined reading needs no migration, because "not there" is already a valid
value. The task shipped in round 13: all three stores carried `version` and
`migrate` via Zustand's `persist` middleware. The settings store's first real
migration (version 2) set `hasSeenOnboarding: true` for existing installs.

**Superseded in round 16** — see below. The cloud-sync migration removed
`persist` (and with it `version`/`migrate`) from all three stores; `settings`'s
schema-version concept survives as `SETTINGS_SCHEMA_VERSION` and
`migrateSettingsDoc`, a plain function run from the Firestore `onSnapshot`
handler instead of `persist`'s `migrate` hook, doing the same
`hasSeenOnboarding: true` migration. The itinerary and routine stores have no
migration hook any more — the first breaking change to either needs one added
to their sync services, not to a `persist` config that no longer exists.

### Round 33 — the email/password flow that only ever worked once, and the way back out

Email/password linking looked like it worked on a fresh address and then failed
forever afterwards, always as the same flat "Couldn't back up your data".

- **Firebase spells "that identity already has an account" two ways.** An OAuth
  credential rejects `linkWithCredential` with `auth/credential-already-in-use`;
  an email/password one rejects it with `auth/email-already-in-use`.
  `isCredentialAlreadyInUse` matched only the first, so for email the merge path
  was unreachable: the first attempt created the account, and every attempt with
  that address afterwards — including a legitimate sign-in on a second device —
  fell through to the catch-all error. It is `isIdentityAlreadyInUse` now, and
  covers `auth/account-exists-with-different-credential` too. `fakeAuth` was
  returning the OAuth code for both, which is precisely why no test caught it;
  it now returns the code the real SDK returns per provider.

- **An email credential is unverified until it is used, and the merge deletes
  first.** `mergeIntoExistingAccount` deletes the anonymous uid's documents
  *before* switching identity — it has to, since the rules make them unreachable
  the instant the switch lands. For Google and Apple that is safe: the provider's
  own sheet proved the credential before it ever reached here, so the switch
  cannot fail on a bad secret. A password can. A typo therefore deleted the
  anonymous account's cloud data and then failed the sign-in, leaving the session
  anonymous with nothing to switch to. The switch is wrapped now: on failure the
  snapshot is written back under the anonymous uid (ids reused verbatim, so it
  restores rather than duplicates) before the error is rethrown. The settings doc
  is not restored — it holds only scalar preferences the local store still has.

- **One generic toast for every failure made this undebuggable from the
  device.** A disabled provider, a mistyped address, a weak password and a wrong
  password were indistinguishable. `describeAuthError` maps the codes worth
  distinguishing and the catch-all keeps the old wording as its fallback. The
  address is also trimmed before the credential is built, and the button's
  enabled check trims too — a keyboard suggestion routinely carries a trailing
  space, which Firebase rejects as `auth/invalid-email`.

- **Still worth checking in the console if it fails on a brand-new address.**
  `auth/operation-not-allowed` means Email/Password is not enabled as a sign-in
  provider in the Firebase project. That is a console setting; no code change
  reaches it. The toast now says so.

- **There was no way back out of an account, so `signOutOfAccount` is the other
  half of linking.** It deletes nothing from the account — signing back in
  brings every document back through the ordinary listeners — but this device
  has to stop holding the data, and the order that takes is load-bearing.
  Listeners come down first, or the next `setState` races a snapshot from the
  account being left and puts its plans straight back. The OS notification
  queue is cleared while the handles still mean something, since the emptied
  stores are the only place they live (best-effort: a stray alert is worth less
  than a sign-out that refuses to finish). The stores are emptied through
  `setState`, never their actions, for the same reason `cloudListeners` uses it
   — an action writes to Firestore, and deleting the account's data is exactly
  what sign-out must not do. Then the migration flag is set for the *new*
  anonymous uid, the same guard `mergeIntoExistingAccount` needs and for the
  same reason: without it the next cold start re-uploads this device's frozen
  pre-migration MMKV blobs into the empty account it just made.

- **Sign-out asks first, which almost nothing else in this app does.** The
  house style is an undo toast rather than a confirm dialog (round 32), but
  undo cannot cover this one: reversing it means re-entering a credential the
  app never held. `confirmSignOut`'s message leads with what survives, because
  the thing people get wrong is reading "Sign out" as "delete my plans".

- **The Settings row stopped putting the address in the button.** A long email
  wrapped a centred line of bold button text across two and read as a broken
  control. The button's label is a short fixed action now ("Your account") and
  the address moved into the hint below it, left-aligned, where a long one
  wraps the way running text is meant to.

### Round 34 — the permission primer App Review rejected, and the dead ends behind it

**Read this first if you are about to "fix" the primer by deleting it.** The
rejection was not about asking for location. It was about *how* the ask was
worded and whether a "no" could be taken back. Removing the primer would make
both worse: the primer is what turns the OS dialog into an informed decision
rather than one that appears out of nowhere — the reason it exists is written at
the top of `NearbyWeatherPrompt.tsx`, and round 3 of `UX.md` is the bug it was
built to fix.

What actually got flagged: a full-screen custom sheet with an **Allow** button,
in the app's filled `primary` colour, sitting directly in front of the system
dialog, over a bare text "Not now". A pre-prompt that puts the app's whole
visual weight behind one of the two answers reads as pressuring the grant. Three
separate fixes came out of it.

- **Neither button argues for an answer any more.** `Allow` → `Continue` on the
  primer, `Allow notifications` → `Continue` on the Settings screen's
  `unprompted` banner. "Continue" is honest about what the button does: it moves
  you to the dialog where the decision is actually made. Both actions on the
  primer now share one outlined style — same size, same border, same text colour
  — so the screen presents two choices and pushes neither. `Show weather near
  me` on `NearbyWeatherPrompt` was left alone: it names a feature, not a grant,
  which is the line to hold when adding another one of these.

- **The copy leads with what the app does *without* the permission.** "Brelly
  forecasts the places on your plans, so it works fine without this… Skipping
  costs you nothing." That is not a softener, it is the truth of the
  architecture: every forecast comes from the place attached to the stop (Google
  Places), and device location only prefills the add-plan field and fills an
  empty Today. The iOS purpose string in `app.json` — the one App Review reads
  beside the dialog — now says the same thing in the same scope ("while the app
  is open"), and `app.config.test.js` asserts it, since `app.json` cannot carry
  a comment explaining why the wording matters.

- **Three purpose strings for permissions the app never asks for are gone.**
  Found by reading the *built* `Info.plist` on the simulator rather than
  `app.json`, which is the only place the difference shows. The `expo-location`
  plugin defaults `NSLocationAlwaysAndWhenInUseUsageDescription`,
  `NSLocationAlwaysUsageDescription` and `NSMotionUsageDescription` to
  "Allow $(PRODUCT_NAME) to access your location" and writes them in whether or
  not you set them — so every build shipped two background-location purpose
  strings and a motion one, in placeholder wording, for APIs no code path
  calls (`requestForegroundPermissionsAsync` is the only request in the app).
  In a rejection that is *about* asking for more than you need, that is the
  next thing to be asked about. Setting each to `false` deletes the key
  (`applyPermissions` in `@expo/config-plugins/build/ios/Permissions.js`);
  `app.config.test.js` asserts it. Reaches a binary only through
  `expo prebuild` + a native build.

- **Every dead end now has a route to system Settings.** This is the half that
  was not just wording. `Linking.openSettings()` had reached exactly two places;
  it is `openAppSettings()` in `src/services/appSettings.ts` now, used by all
  four, with the cross-platform behaviour asserted once. The rejection is worth
  reading as: *a permission decision the user cannot revisit is the problem*.
  - **The primer** branches on the permission state instead of assuming there is
    a prompt left. Already `denied` → "Open Settings", and it must not fire a
    request the OS resolves instantly to nothing; that is a button that visibly
    does nothing, which is how the original bug felt from the outside.
  - **The add-plan form** said "Location permission denied" — the failure named,
    with no hint the form still worked. It now says the stop can still be typed,
    and offers Open Settings. `useCurrentLocation` returns `permissionDenied`
    separately from `error` because it gates an *action*: a refusal is the one
    failure here that Settings can fix, and "no fix came back" deliberately gets
    no Settings link.
  - **The Settings screen** had no location entry at all, so a "Not now" in the
    first five seconds of a new install was unreachable forever after. There is
    a Location row beside Notifications now: the current state, one line on what
    it is for, and the right action per state — prompt while `unprompted`, open
    Settings once `denied`, nothing when `granted`.

**The one refactor.** Settings needed the same two effects `useNearbyForecast`
already had — read the status without prompting on mount, re-read on return to
the foreground — and nothing else that hook does. Both are
`useDeviceLocationPermission` now, and `useNearbyForecast` reads it.

**And the gate on that second effect had to go, which was a real bug.** The
foreground re-read fired only while the permission was `denied` or
`unavailable` — the states with something to recover. Written that way it only
ever noticed the change it was looking for. Switch a *granted* permission off in
system Settings and nothing re-read it: every screen carried on saying "Location
is on", and the store carried on holding the point, so "Right now" kept
reporting the weather at a location the user had just revoked access to. The
listener now runs from any state, and `sync()` clears `region` and `coords`
alongside a permission that is no longer granted. Two things the old reasoning
got wrong, both worth keeping in mind before gating a permission read again:

- The argument for the gate ("an app that has never asked isn't listed in
  system Settings, so `unprompted` has nothing to come back and find") is an
  iOS argument. On Android an app is listed with its permissions before it has
  ever asked, and can be granted from there without a dialog ever appearing.
- A permission read is not only how a refusal is recovered. It is also the only
  way a *revocation* is ever noticed, and that direction has no affordance
  anywhere in the app to hang a listener off.

The cost of not gating is one `getForegroundPermissionsAsync` per foreground and,
while granted, the position read that follows it — paid for by the fact that
"the weather where you are now" is a different place after a trip out of the
app anyway.

Testing: 1366 tests across 120 suites. The assertions worth keeping are the
negative ones — `denied` calls `openSettings()` and does *not* call
`requestForegroundPermissionsAsync` / `requestPermissionsAsync`, and skipping
the location step still advances onboarding to the end.

### Round 35 — ITMS-90683: the motion purpose string could not be deleted

Round 34 removed three purpose strings for permissions the app never asks for.
Two of them were free. The third came back from App Store Connect as
**ITMS-90683, "Missing purpose string in Info.plist"**, and the upload never
finished processing.

**Apple scans the binary, not the code paths.** `expo-location` imports
CoreMotion and calls `CMMotionActivityManager` in
`node_modules/expo-location/ios/Providers/MotionActivityStreamer.swift`. That
compiles into every build whether or not a line of JS ever reaches
`watchMotionActivityAsync` — the app only ever calls
`requestForegroundPermissionsAsync`, and it made no difference. A referenced
sensitive API with no matching `NS*UsageDescription` fails the check. So
`motionUsagePermission` is a string again in `app.json`, and it says the honest
thing: Brelly does not use motion activity, and the key is there because the
library links the framework. See the v57 config-plugin props at
https://docs.expo.dev/versions/v57.0.0/sdk/location/.

**The two Always-location keys stay deleted, and that is not luck.** Nothing in
`expo-location`'s pod calls `requestAlwaysAuthorization` — grep it before
assuming the same fix applies to them. The rule the round leaves behind:

> A purpose string can be deleted only when the *binary* holds no reference to
> the API, not when the app holds no call to it. Check the pod's native
> sources, not your own.

`app.config.test.js` now asserts both halves separately, so a future cleanup
that deletes the motion string again fails a test instead of an upload.

**Why the local build did not catch it.** `ios/` is gitignored and had not been
re-prebuilt since the round-34 edit, so the Info.plist on disk still carried the
old keys and everything ran. The only place the difference shows is a fresh
`expo prebuild` followed by an actual upload.

### Round 36 — Phase 0 of the web migration: de-risking the harness

The first three commits of the Next.js monorepo migration ([`WEB.md`](WEB.md)).
No structure changed; the point was to fix the things that would have failed
*during* the move and looked like the move's fault.

**`expo lint` was linting a third of the repo.** It only ever walks `src/`,
`app/` and `components/`
(`@expo/cli/build/src/lint/lintAsync.js:88`), so `yarn lint` exited 0 while
`npx eslint . --max-warnings 0` exited 1 with **172 errors across 7 files** —
`jest.setup.js`, `__mocks__/`, `plugins/*.test.js`, `app.config.test.js`. They
were 170 `no-undef` (those files are Node + Jest, and the flat config never
said so) plus 2 `react/display-name`, with a third failure from a stale
`eslint-disable` in the generated `.expo/types/router.d.ts` that
`--max-warnings 0` counts.

`yarn lint` is now `eslint . --max-warnings 0`. The flat config declares
`globals.node` + `globals.jest` for that file set, ignores `.expo/`, and the two
mock components got real `displayName`s rather than a rule-off. No
`eslint-disable` was added to any source file. The three
`/* eslint-env jest */` comments went too — flat config ignores them and ESLint
10 will error on them.

> If a lint rule "already passes", check what the linter was actually pointed
> at before believing it.

**The verify gate named its checks in three places.** `.claude/hooks/verify-gate.sh`,
`ci.yml` and `yarn verify` each spelled out `npx tsc --noEmit` by hand. After
Phase 2 there is no root `tsconfig.json`, so a bare `tsc --noEmit` exits
`TS18003` and the Stop hook would have blocked with an error that reads as
unrelated to the migration. The checks are named once now — `typecheck`, and
`verify:fast` (jest) beside `verify` (coverage) — and the hook and CI call
those. Phase 2 changes `typecheck` to the per-workspace form in one place.

**The sync layer pulled `expo-haptics`.** `saveWithFeedback.ts` imported
`utils/haptics.ts`, and its `notifyCloudSyncFailure` is imported by all three
sync services plus `backup.ts` — so every file that has to end up in
`packages/core` reached a native module through one import. `toastStore` was
already the seam: `utils/toastHaptics.ts` subscribes to it, matches the haptic
to the toast variant, and the mobile entry subscribes once at module scope.
`hapticDelete`/`hapticToggle` are called from UI components and stayed put.

The deliberate side effect is that **every** toast buzzes now. Toasts raised
outside `saveWithFeedback` — a failed calendar write, a weather refresh that
couldn't reach the service — were silent before.

While in that file: its docblock still described zustand `persist` calling
`mmkvStorage.setItem` synchronously inside `set(...)`, which is why the `try`
existed. The stores dropped `persist` (`itineraryStore.ts:119-125`,
`settingsStore.ts:67-73`), so that `catch` is a backstop and nothing more. The
comment and the test comment repeating it now say so.

**The OTA hazard this phase opens.** All three commits touch `package.json`
`scripts`, and the Expo fingerprint hashes `scripts`, so the runtime version has
moved and `main` can no longer produce the shipped fingerprint. `main` at
`6c135de` is tagged **`ota-baseline-pre-monorepo`** so an emergency hotfix is a
checkout. Cut `production` and `preview` native builds from that tag before
Phase 1.

Testing: 1381 tests across 122 suites.

### Round 37 — Phase 1 of the web migration: `packages/core`

Fifteen commits plus one bug-fix commit. The repo root is still the Expo app;
what changed is that 16 of the 67 modules it used to own now live in
`packages/core`, and the other app that will need them can have them without a
copy. [`WEB.md`](WEB.md) holds the design; this is what actually happened and
where it differed.

**The rule the whole phase runs on: alias for behaviour, inject for values.**
Where the two platforms do the same thing by different means, core imports a
bare specifier no package provides — `@brelly/platform/firestore` and seven
siblings — and each app resolves it in its own `tsconfig.json` `paths`, to its
own directory of implementations. One declaration, honoured by `tsc`, by Metro
(which reads tsconfig paths natively) and by Jest (through `jest-expo`'s
`withTypescriptMapping`). Where the two platforms merely need *different
values*, no alias can help: `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` are literal
text substitutions each bundler performs on its own files, so
`process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY` inside a file Next compiles is not
a variable that resolves to nothing — it is a string nothing rewrites. Those go
through `configureCore()`, called from `src/app/_layout.tsx` and from
`jest.setup.js`.

**The eighth seam is the one that makes the extraction possible.** Seven of the
eight are what you would guess — Firestore, storage, dialogs, haptics,
notifications, app settings, auth. The eighth is `@brelly/platform/firebase`,
and without it the boundary is a fiction: six core-bound modules import
`services/firebase.ts`'s *wrappers* (`getFirebaseAuth`, `generateDocId`,
`ensureAnonymousUser`, …), which exist in **neither**
`@react-native-firebase/firestore` nor `firebase/firestore`. A "re-export the
same names" seam cannot carry a name that neither package has.

`@brelly/platform/random` from `WEB.md`'s list is **not** here. Its reason to
exist is the Phase 4 fix that mints the Places session token in the browser,
and it needs `expo-crypto` added — `crypto.randomUUID()` does not exist on this
runtime, with no polyfill in `expo/src/winter/` or RN 0.86/Hermes. An unused
seam carrying a new native dependency for three phases is worse than no seam.

**`signInWithProvider(request)` could not do the job the plan gave it.**
Acquiring a credential and linking it are two steps only because a phone allows
them to be; on the web `signInWithPopup` *is* the sign-in. So the seam is
`linkProvider(request)`, which does both and hands the credential back —
because the merge that follows switches identity *after* deleting the anonymous
user's documents and needs that same credential. Re-acquiring it there is a
second provider sheet on a phone and a popup blocked for want of a user gesture
in a browser. The sign-in itself reuses the `firebase` seam's existing
`signInWithLinkedCredential`.

**The barrel cannot be where tests mock.** This is the trap of the phase, and
it cost two false starts.

- `jest.setup.js` requiring `@brelly/core` for `configureCore` instantiates all
  67 modules during setup, *before* any test file's `jest.mock` factories run —
  and a module already in the registry keeps the real bindings it closed over.
  `forecastProvider.test.ts`'s own `jest.mock("./weather")` silently stopped
  working. Setup reaches `packages/core/src/config` directly now.
- Rewriting 29 app-side `jest.mock("@/services/weather")` calls to
  `jest.mock("@brelly/core", …)` breaks six suites, and not for a fixable
  reason: a barrel is one module, so replacing its `getForecastForSlot` does
  nothing to `forecastProvider`'s own `./weather` import. Core's internal calls
  never pass through the barrel.

  They name the module instead — `jest.mock("@brelly/core/services/weather")` —
  which works because Jest keys its registry by **resolved path**, so replacing
  the file intercepts every importer including relative ones. The lint rule
  draws the line at *imports*: `src/**` may not import `@brelly/core/*`, which
  leaves `jest.mock` alone. Source depending on where core keeps a file is what
  stops core moving its own files; a test naming a module to replace is not
  that.

**`export *` over 67 modules is safe here, and it was checked.** No two modules
in the package export the same name, so nothing is dropped the way an ambiguous
star re-export silently would be. `index.test.ts` asserts against the directory
that every module is re-exported — a module missing from the barrel is exactly
what makes someone reach past it. `test/` is the one exclusion: the fakes are a
second entry point, `@brelly/core/test`, deliberately outside the barrel
because the barrel is what the apps bundle.

**Core now runs its own suite, and that is a claim rather than a convenience.**
`packages/core/jest.config.js` resolves the five seams core actually uses to
platform-free fakes in `src/test/platform/` and runs under `jest-expo/node`. It
is not a duplicate of the root run: that one resolves `@brelly/platform/*` to
`src/platform/`, so it proves core works *on a phone*. This one proves core
imports nothing secretly Expo-shaped — the question `apps/web` would otherwise
answer in Phase 3, by way of a Next build failing on `react-native`. All 59
core suites, 581 tests, pass that way. `yarn test:core` runs it, `yarn verify`
includes it, and CI has its own step. Two mechanical notes: `jest-expo/node`
drops the babel `presets` the default preset supplies and this repo has no
`babel.config.js` to fall back on, so the config restates the transform.

**Three merge defects that the phone hides and a browser tab does not.** These
came out of moving `accountLinkService.ts`, and all three are real today.

1. `snapshotLocalData` read the **Zustand stores**, which are a mirror of the
   Firestore documents populated by `onSnapshot` after boot — and the value it
   returned decided what got *deleted*. A session that starts a merge before its
   listeners hydrate saw an empty account, deleted nothing, and orphaned
   everything under a uid nobody can reach again. It is `readAnonymousData` now,
   a pre-switch `getDocsFromServer` read. `getDocsFromServer`, not `getDocs`: an
   offline client answering out of its cache reports "nothing here" with
   complete confidence, which is the same failure in a different coat.

   The one value still feeds all three call sites — delete set,
   restore-on-failure, merge into target. Repointing only the delete set is
   *worse* than the bug: the delete removes what Firestore holds and the
   restore, still reading an empty local snapshot, returns early and writes
   nothing back.
2. The crash record was written **only in the add branch**, so *"Don't add"*
   ran the delete with nothing to recover from. The `try/catch` around the
   sign-in compensates for a rejected sign-in; it cannot compensate for the
   process ending, and a browser tab is closed mid-flow all the time. The record
   is `{ anonUid, snapshot, addLocalData }` now and is written before *every*
   delete — and it is allowed to throw, because `localStorage.setItem` raises
   `QuotaExceededError` in Safari's private mode and a delete with no record is
   precisely what it exists to prevent. `resumePendingMergeIfNeeded` gains the
   third case that makes the wider record worth writing: still anonymous, uid
   matches the record, so the delete ran and the switch never did — restore
   under the same uid and the same ids.
3. `snapshot.isEmpty` at the call site meant "the store has not loaded", not
   "this user has no data", and `account-link.tsx` short-circuited on it
   straight into the discard branch **without showing the merge prompt**. One
   line down it would have asked "Add your 0 plans and 0 routines to it?", which
   is the same bug with a dialog on it.

**The merge order was not touched, deliberately.** `firestore.rules` gates read
and delete on `request.auth.uid == <path uid>`, so signing in before deleting
makes every delete under the anonymous uid fail `permission-denied` and orphans
its documents permanently. Enumerate, persist, delete, then switch identity.
The `try/catch` around the sign-in is the compensation that order requires, not
a smell.

**Phase 1 is not fingerprint-neutral, and `PLAN.md` asked for that to be
measured rather than assumed.** It moved: `e6c67e75…` → `ec1ec143…`. The cause
is a single source, `contents:packageJson:scripts` — `test:core` is new and
`verify`/`verify:fast` changed. Nothing else hashed moved: `.gitignore`,
`app.json`, `app.config.js`, `plugins/` and `eas.json` are byte-identical to
`7b1fec9`, and dependencies are not hashed at all, so `@brelly/core` itself is
invisible to it. (Measure in the real checkout, not a `git worktree` with a
symlinked `node_modules` — the autolinking `dir` sources are relative paths and
all ~150 of them move, which drowns the signal.) Phase 2 bumps the hash
unconditionally anyway, so the practical consequence is only that a native
build has to precede it.

Verified beyond the suite: `npx expo export --platform ios` bundles clean, which
is what proves Metro resolves `@brelly/core` through the Yarn workspace symlink
and `@brelly/platform/*` through tsconfig paths.

Testing: 1413 tests across 127 suites at the root, plus 581 across 59 in
`packages/core`'s own run.

### Round 38 — Phase 2 of the web migration: the physical move

The root stops being the Expo project. `src/`, `assets/`, `plugins/`,
`targets/`, `__mocks__/`, `app.json`, `eas.json`, `tsconfig.json` and
`jest.setup.js` move under `apps/mobile/`; `src/test/emulator/` comes out to
`tests/firestore-rules/`, because it tests `firestore.rules`, which stays at
the root. Four commits, and the first one is ~250 renames.

**One commit for the renames, run as one non-interactive script.** Git's rename
detection is per-file, so splitting gains nothing and leaves a broken
intermediate commit. The reason to run it as a single tool call is the Stop
hook: it triggers on working-tree state, so a pause halfway through 250
`git mv`s blocks on a tree that cannot pass anything.

`git mv` could not do all of it, and the two things it missed fail differently.
The gitignored-but-load-bearing files — `.env`, `GoogleService-Info.plist`,
`google-services.json` — fail **silently**: Expo reads `.env` from the project
root only, so without the move a local run inlines `undefined` into
`geocoding.ts` and `auth.ts`, both of which use `!`. (`prebuild` printing
`env: load .env` is what proves it landed.) The untracked build output — `ios/`,
`android/`, `coverage/`, the widget's generated `Info.plist` and
`Assets.xcassets/` — fails **loudly but confusingly**: stranded at the old
paths, the next commit's re-anchored ignores no longer cover them, and c2.2's
own gate fails on artifacts with nothing to do with it.

**Reviewability is two commands, not 250 diffs.** An earlier draft's version was
wrong twice — `git show --numstat` always prints the commit header, and
`--diff-filter=R` hides both the A+D pairs below the rename threshold and the
genuinely modified files. The corrected pair also has a false-positive class
worth filtering, because a 100%-similar *binary* rename prints `-\t-`:

    git show --numstat -M --format= HEAD \
      | awk '($1!="0" || $2!="0") && !($1=="-" && $2=="-")'

    diff <(git ls-tree -r HEAD^ | awk '{print $3}' | sort) \
         <(git ls-tree -r HEAD  | awk '{print $3}' | sort)

The first named 12 files; the second proved it by blob hash rather than by
heuristic. No `.git-blame-ignore-revs` entry — `blame` and `log --follow` do
rename detection by default.

**The coverage plan in `WEB.md` was half right, and the half that was wrong is
the interesting half.** It called for three independent gates, and that turns
out not to be a preference: coverage does not cross a `rootDir` boundary. With
`../../packages/core/src/**` in `apps/mobile`'s `collectCoverageFrom`,
`shouldInstrument` returns `true` for a core file, the module loads and
executes, and it still never reaches the coverage map — the threshold group
fails `Coverage data ... was not found`. What `WEB.md` got wrong was the
number. "Core is pure functions, raise it to 95/90/95/95" measured at
**81/85/79/82**, because the five sync services live in core but their tests
live in `apps/mobile` — they exercise the mobile bindings and import
`expo-notifications` and `@/store/mmkvStorage`, so they cannot move. Exclude
those five and core's own suite measures **98.5/94.4/98.5/99.1**, and 95/90/95/95
is right after all. The hole is in the traps section above.

Core's tests still run twice, as they did under the old root config: `roots` in
`apps/mobile/jest.config.js` keeps them in the mobile pass, where
`@brelly/platform/*` resolves to the Expo implementations. `yarn test:core` is
the other run, against the fakes. 128 suites / 1414 tests, plus 59 / 581.

**Two lint bugs surfaced only once the config was rescoped, and both were
silent.** Scoping `eslint-config-expo/flat` to `apps/mobile/**` takes the
TypeScript parser away from `packages/core`, and the symptom is not an error
about the config — it is `Parsing error: Unexpected token {` on every core file
and a boundary rule that never runs. Element 7 of that config is this repo's
only parser source (`typescript-eslint` itself is not installed; only
`@typescript-eslint/parser`, transitively), so `packages/core/**` goes in the
same `files` block. And the boundary rule's own patterns are gitignore syntax,
not minimatch — the traps section has both halves of that.

`WEB.md`'s ESLint verification asked for `react-native/*` rules on a mobile file
and `> 0`. There are none: `eslint-config-expo/flat` contains no `react-native`
rules at all. The check that discriminates is the parser
(`typescript-eslint/parser@8.65.0`, not `espree@10.4.0`) plus the rule count —
84 on a mobile or core file, and 0 on a web one once `apps/web` exists.

**The gate for c2.2 is `prebuild --clean`, not `expo config --type introspect`.**
Introspect proves the config evaluates and nothing about anchors:
`withIntrospectionBaseMods` deletes every non-introspective mod, and all three
local plugins are `withDangerousMod` or `withXcodeProject`. Run from
`apps/mobile`, prebuild regenerated both native projects, CocoaPods installed,
`git status --porcelain` came back empty, and all three anchors landed — two
`[RNFB]` build phases in the pbxproj, `React-VFS.yaml` and
`BRELLY_EMBED_DYLIBS_ONLY` in the Podfile.

**The fingerprint moved, and this time it was guaranteed rather than measured.**
`Hash.js:32` hashes `createSourceId(source)` = `filePath`, and the autolinking
`sourceDir`s are `path.relative(projectRoot, …)` — so all ~150 `dir
node_modules/…` sources gained `../../` and `expoAutolinkingConfig` changed with
them. OTA is closed until a native build ships from this tree. Moving the plist
into `apps/mobile` does *not* contribute: it is hashed
`expoConfigExternalFile:contentsOnly`, and `postUpdateExpoConfig` deletes
`ios.googleServicesFile` from the hashed config.

No `.easignore` was added. None exists today, so it would be a new hashed source
— and since EAS archives from the VCS root, a file at the Expo project root
changes nothing about what is uploaded, which is the file's whole purpose.

Other things that had to move with it: `plugins/withFirebaseSpmPostIntegrate.test.js`
reached `../node_modules/@react-native-firebase/app/firebase_spm.rb`, which is
empty under a hoisted workspace install — it resolves through the package now,
and it is precisely the test that catches an upstream re-anchor.
`packages/core/src/index.test.ts` asks for `@types/node` explicitly, having been
getting them by accident from the emulator suite's triple-slash reference under
the old root `**/*.ts` glob. And the root `package.json`'s inline `jest` key is
retired, so a stray root `npx jest` can no longer pick up `preset: jest-expo`
with `rootDir` at the repo root.


### Round 39 — Phase 3 of the web migration: `apps/web`

A Next.js 15 App Router app in `apps/web`, reusing `packages/core` through the
`@brelly/platform/*` seams. Seven commits. ~8,100 lines of source and ~7,900 of
test, 549 tests at 96.6/90.8/93.4/98.2. `apps/mobile` changed in two ways only,
both of them deletions the phase called for: `react-native-web` and the
`"web": "expo start --web"` script, and `app.json`'s now-meaningless `web`
block.

**The seams were the schedule.** The first `yarn typecheck:web` failed eight
times with `Cannot find module '@brelly/platform/*'`, and that is the design
working rather than a setback: core is compiled a second time inside the Next
project, so the list of missing modules *is* the list of files to write. Nothing
about core changed to make the web build work.

**One palette, two apps, and the copy lives in TypeScript.** `Colors`,
`Spacing`, `IconSize`, `MaxContentWidth`, `HeaderHeight` and the `ThemedText`
variants moved into `packages/core/src/constants/theme.ts`; both apps re-export
them *by name* through the barrel. `apps/mobile/src/constants/theme.ts` keeps
only what is `Platform.select` — `Fonts`, `BottomTabInset` — plus its
`global.css` import.

The web's CSS custom properties are emitted **at render time** by
`buildTokensCss()` in the root layout, not written to a committed generated
file. A generated file has two failure modes a function has none of: it can be
stale, and it has to be built before anything that reads it. There is one copy
of the palette and it is the TypeScript.

Tailwind's own namespaces are cleared in `@theme` (`--color-*: initial`, and the
same for spacing, radius, text, font, shadow), so `p-4`, `rounded-lg` and
`bg-slate-200` do not exist in this app. What is emitted instead is
`px-three`, `rounded-control`, `bg-background-element`, `text-title` — checked
in the compiled CSS, not assumed. That is the `ui-implementation` skill's rule
made mechanical: an untokened value is not a lapse of discipline, it is a class
that does not compile.

Six token groups were genuinely missing and were added under the skill's
stop-and-ask gate rather than invented: `Radius`, `ZIndex`, `Opacity`,
`Elevation.dropdown`, `Duration`, `HitTarget`.

**Material Symbols is not in `next/font/google`'s catalogue.** Found by a
failing `next build`, not by reading. The answer is a Google Fonts `<link>` with
`icon_names=` subsetting — the full rounded variable font is megabytes and the
subset for this app's list is kilobytes — and `components/icons.ts` is a closed
registry because the font *is* that subset: an icon drawn from outside the list
has no glyph and renders as its own name in words.

**Four accessibility corrections, all of them the same shape: RN markup that is
not HTML.**

- `role="text"` is WebKit-only and not an ARIA role. `WeatherBadge` uses
  visually-hidden text plus `aria-hidden` visible parts instead.
- `accessibilityRole="radiogroup"` is free on iOS and a promise on the web: an
  ARIA radiogroup owes arrow keys and roving `tabindex`, and half-implementing
  that is worse than not claiming the role. `ChipGroup` and `RepeatField` are
  real `<input type="radio">`/`<input type="checkbox">` in a `<fieldset>`, so
  the browser supplies the keyboard model.
- `accessibilityRole="summary"` on the routine row is not an ARIA role at all.
- `Text as="label"` around a `<label htmlFor>` nests two labels. Both sites now
  render one plain `<label>` carrying the token classes.

**The dirty-form guard is three mechanisms, because a web page has three
exits.** In-app links go through `guardNavigation` on `Link`'s `onNavigate`,
which is the only one that can ask *before* anything happens. Browser Back
cannot be cancelled, so the guard pushes a sentinel history entry while the form
is dirty and re-pushes it on a "keep editing". Tab close is `beforeunload`. The
known cost is recorded in the hook: a spare history entry survives a save, so
Back needs one extra press afterwards — unwinding it on unmount races the
navigation that caused the unmount.

Worth recording that the native baseline was weaker than it read:
`gestureEnabled: false` blocks the iOS swipe only, so Android's hardware Back
already discarded a dirty form. Two of three platforms gain behaviour here.

**Three decisions about what a second client may do.**

- The web **does** run the routine materialiser. Deleting a routine is a delete
  plus a sweep, so a client that materialised nothing would delete the rule and
  leave a fortnight of its stops standing. The write is idempotent by
  construction: `materializedSlotId` is deterministic in `(routine, date)`, so
  two clients computing the same action produce the same document id.
- The web **does** let a stop be muted. `notificationsMuted` is read off the
  same document by the phone, so muting from a laptop is a real cross-client
  action rather than a feature the web does not have.
- The web **must not** write `hasSeenOnboarding` and shows no primer. That flag
  suppresses the phone's location primer — the copy App Review litigated — and a
  new web user flipping it would turn that off for a phone that had never asked.

**`/api/places` is an allowlist, not a proxy.** A forwarding proxy for a key
with no per-user scope is a public, unauthenticated, billed relay for the whole
Places API. Three upstream calls are reachable; every other path is a 404 before
the key is read. The autocomplete body is *rebuilt* from validated fields rather
than forwarded — otherwise a caller could set `includedPrimaryTypes` or another
SKU's parameters on a key it cannot see — and the field mask is a server-side
constant for the same reason: the mask decides the SKU. Google's error bodies
never cross the route; on the Geocoding arm the key is in the query string the
error quotes back.

**Test traps, each found the expensive way.**

- Writing to a core store reaches the sync layer, which calls `getAuth()`. Every
  web test therefore needs the Firebase mocks in `jest.setup.ts`, or the first
  `setState` throws `auth/invalid-api-key`. Wiring that up needs
  `"^@brelly/core/(.*)$"` in the web Jest `moduleNameMapper` and
  `"@brelly/core/*"` in its tsconfig paths: the package has no `exports` map, so
  `@brelly/core/test` otherwise resolves to a nonexistent `packages/core/test`.
- `updateSlot` re-files a slot into the bucket matching `toDateKey(startTime)`.
  A fixture whose `date` disagrees with its slots' start times moves them on the
  first write, and a later revert finds nothing — an undo that silently does
  nothing. `makePlan` documents it; `useMuteSlotWithUndo.test.tsx` is where it
  cost an hour.
- `updateSlot` also **mints a new id** when an update clears `routineId`. That
  is deliberate — a detached day must not be rewritten or swept by anything
  holding the materialised id — so the edit page's "this day only" test looks
  the slot up by position, not by id.
- `filterPlans` requires every term to appear *somewhere* on the stop. "Stop 1"
  is two terms and the digit matches the shared postal code, so six fixtures
  named that way all match and the filter looks broken. Distinct one-word labels.
- A test file with no static imports is a global script, so two of them can
  collide on `Cannot redeclare block-scoped variable`. `export {};` fixes it.
- Route handlers and `placesProxy.ts` need `@jest-environment node`: jsdom has
  no `Response`.
- `next-env.d.ts` must stay the stock two lines. `typedRoutes: true` rewrites it
  to reference a generated `./.next/types/routes.d.ts` that CI has never built.

**`react-hooks` caught two real things, not style.**
`set-state-in-effect` on `useAuthUser` was right that auth *is* an external
store — a current value plus a subscription — and `useSyncExternalStore` also
gives the server an answer (`null`) where `getAuth()` must not be called at all.
`preserve-manual-memoization` was right that a `useMemo` over `upcoming` never
hits, because `splitPlansByTime` rebuilds that array every render.

**What web does not do, and why each is hidden rather than half-built:** rain
notifications, the daily digest and "Check your alerts", calendar import and
export, the iOS widget, OTA and `UpdateBanner`, haptics, the splash animation,
`localDataMigration`. Settings therefore shows three of the phone's seven
sections. That is safe for the shared document because every write goes through
an individual setter and `writeSettingsFields` merges with `{merge: true}` — a
client that never renders those cards never writes their fields.

Two things the phone does that the web deliberately does *not* copy.
`useCurrentLocation` has one geocoder where the phone has two: there is no
on-device reverse geocoder in a browser, so a failure falls through to
"Current location" and `formatReverseGeocodedAddress` has no caller here.
And `account-link`'s `Platform.OS === "ios"` gate on Continue with Apple is
dropped rather than ported — it exists because `expo-apple-authentication` only
exists on iOS, and Apple's JS Sign In works in any browser.
