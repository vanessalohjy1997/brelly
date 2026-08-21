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
  `timestamp`, not `date`). The same trap applies to Open-Meteo: it's used
  both `weathercode`/`weather_code` and `windspeed_10m`/`wind_speed_10m`
  across API versions — `services/openMeteo.ts`'s field names were confirmed
  against a live curl, not the docs.
- **Open-Meteo's `hourly.time`/`daily.time` carry no timezone suffix at
  all**, even with a timezone param set — `timezone=auto` returns the
  location's *local* wall-clock time with nothing to disambiguate it from
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
  `collectCoverageFrom` over *all* of `src/**` — not just the files a test
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
- **`@expo/ui` can't see React's Objective-C headers, and the fix is a
  Podfile patch.** Compiling `ExpoUITouchHandlerHelper.mm` fails with
  `'React/RCTSurfaceTouchHandler.h' file not found`, which reads like an
  `@expo/ui` version problem and is not one — the file is in 57.0.7 too, so
  there is no patch release to move to. Because `RCT_USE_PREBUILT_RNCORE=1`,
  React ships as a prebuilt `React.xcframework` whose headers live under
  `React_Core/`, `React_RCTFabric/` etc. rather than `React/`. Clang resolves
  `React` as a *framework*, doesn't find the header in it, and never falls
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
  project", *after* `post_install` — so on a newly created `ios/` all four
  silently skip. A second `pod install` fixes it because the phase now exists.
  `plugins/withFirebaseSpmPostIntegrate.js` re-runs RNFirebase's own
  (idempotent) functions from `post_integrate`, which runs after integration,
  so one prebuild is enough.
  The three failures that hides, in the order they were hit: the app crashes
  at launch with a missing-library dyld error (no embed phase); the build dies
  at link time with `Undefined symbols … "_OBJC_CLASS_$_FIRApp", referenced
  from: in AppDelegate.o` (no FirebaseCore link); and a Release *archive*
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
  `project.native_targets`, so the *project-level* configurations keep
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
  populated by the Archive action — and it holds *every* archive-time build
  product, CocoaPods' static pod frameworks included, not just Swift Package
  ones. The sweep is a bare `find -name "*.framework"`, so all of them get
  copied into `Frameworks/`, and App Store validation rejects a static `ar`
  archive there as ITMS-90171. `plugins/withFirebaseSpmPostIntegrate.js`
  splices a `file -b`-based guard into the phase so it only embeds dynamic
  frameworks. Nothing local can catch this: the sweep is inert outside an
  archive, the EAS build itself *succeeds*, and the rejection only lands at
  `eas submit`. Check the artifact, not the build status — `unzip` the `.ipa`
  and run `file` over `Payload/*.app/Frameworks/*.framework/*`; everything
  there must be a Mach-O dylib.
- **A native picker's props are invisible when the mock drops them.** The
  `DateTimePicker` stub in `jest.setup.js` forwards `themeVariant`, `mode`,
  `value` and `onValueChange` on purpose: each was, at some point, the only
  thing a test could check. `themeVariant` is what keeps the picker in the
  app's theme rather than the device's, and `mode` is the only way to tell the
  Day picker apart from Starts and Ends. Adding a prop the mock swallows means
  the test passes and the app is wrong.
- **A slot's `notificationId` must never leave the device that wrote it.** It
  is a handle into *this* device's notification queue, and
  `notificationLeadMinutes` is the lead time that particular alert was
  scheduled against. Carried anywhere else — into a backup file, onto a second
  device, or back onto this one after the alert was cancelled — the stop looks
  permanently scheduled: `planNotificationResync` reads `!!notificationId` as
  "has an alert", finds the lead time unchanged, and does nothing, so no alert
  is ever scheduled and nothing on screen says so. Worse, it *half*-works: if
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
  against the plans it's handed, so it's idempotent *given accurate state* —
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
  `setOptions({ gestureEnabled })`, which is the *only* trace it leaves —
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
  *functions* for the same reason — a chained mock object would fake an API
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
  the dynamic config has to be *tracked by git* (an untracked `app.config.js`
  is not uploaded, so EAS reads `app.json` alone and looks for the gitignored
  relative path), and the file variables have to *exist on EAS* for the
  environment the build profile names in `eas.json` (`production` →
  `"environment": "production"`). Both are set now, on `production`, `preview`,
  and `development`, via
  `eas env:set --type file --visibility secret --name GOOGLE_SERVICES_INFO_PLIST --value ./GoogleService-Info.plist`.
  They are `secret`, so `eas env:list` shows `*****` and they cannot be read
  back — to rotate one, re-run `env:set` from a local copy. `app.config.test.js`
  pins the override precedence in both directions so a refactor cannot quietly
  drop it.

- **The iOS release workflow authenticates to Apple through an App Store
  Connect API key held on EAS, not through an Apple ID in repo secrets.** This
  repo is public, so the Apple account email and an app-specific password both
  stay out of it. `eas credentials --platform ios` → *App Store Connect: Manage
  your API Key* → *Set up your project to use an API Key for EAS Submit* stores
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

## Built so far

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
  `isImporting` flag in `settings.tsx` belongs to the *calendar* sync, which is
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
  *other* caller, `useDeleteSlotWithUndo`. See the trap above for what carrying
  the handle costs. Fixed by stripping on export *and* on import (files written
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
  spread. Two consequences: the imported slots still carried the *old*
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
  doc/collection, so no screen changed how it *reads* data — only the loading
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
  snapshot arrives. It waits on Keychain auth restore plus the first *cached*
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
  `auth/credential-already-in-use`, which is the signal — not an error — to
  run the merge: because the security rules block reading one uid's documents
  while authenticated as another, the merge is driven from the **local**
  Zustand state (never the frozen MMKV blobs), not a cloud-to-cloud copy. The
  user is prompted before anything merges (skipped only when the local
  snapshot is empty — nothing to offer), the anonymous uid's docs are deleted
  before the identity switch (they become unreachable the instant it happens),
  and on the far side any id collision with the target account's own docs
  mints a fresh id rather than overwriting — overwriting would silently
  destroy a plan that already lived there, the worst outcome a merge could
  produce. Settings never merge (a union of scalar preferences is meaningless;
  the joined account's settings win). The merge isn't atomic — it spans two
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
  assert a *different* user can't read or delete it) — the only place rules
  are bypassed on purpose, since seeding through the rules themselves would
  make the seed itself part of what's under test.
- This suite is deliberately **not** part of `yarn test`: it needs a running
  emulator process, which `yarn test:emulator` (new script) provides via
  `firebase emulators:exec --only firestore`, and it needs its own
  `jest.emulator.config.js` — `jest.setup.js` mocks
  `@react-native-firebase/firestore` out entirely for every other test, which
  is exactly what this suite must *not* have happen, so it can't share the
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
  *behind* it. Confirmed on a real iOS 26.5 simulator (`xcrun simctl` install
  + `openurl` deep link to drive it, since there's no touch-input path
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
  from the `Text` node one level) still passes: the `Pressable` sits *outside*
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

The card's top-right clock only took a *live* reading's age. An outlook or an
offline one spelled itself out under the temperature instead, on the reasoning
that "just now" beside a clock icon would misstate a 4-day outlook. The word
was right; the placement wasn't.

- **Which tier answers is geography, not anything the reader can see.**
  `getForecastForSlot` hands anything more than a day out to NEA's 4-day
  outlook (`source: "4day"`), while `fetchOpenMeteoForecast` keeps the hourly
  tag for a full week (`HOURLY_CONFIDENCE_DAYS = 7`). So a Singapore stop
  tomorrow got "Outlook · 1h ago" buried under its temperature, and an
  overseas stop *further* ahead got a tidy corner clock. Same card, same
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
  Inside a reusable workflow `github.workflow` resolves to the *caller's*
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
