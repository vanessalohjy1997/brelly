/**
 * The `@brelly/core` barrel — the only specifier either app names.
 *
 * Apps import from here and never from a path inside the package. That keeps
 * core free to reorganise its own directories without touching two app trees,
 * and it is the app-facing half of the rule `no-restricted-imports` enforces
 * from the other side: core must not reach back into an app, and an app must
 * not reach past this file.
 *
 * `export *` throughout, and it is checked rather than hoped for: no two
 * modules in the package export the same name, so nothing is silently dropped
 * the way an ambiguous star re-export would be. Adding a module here is free;
 * adding a *colliding* name to one is what would break, and `tsc` says so at
 * the import site.
 *
 * One consequence worth knowing before writing a test against it. A barrel is
 * one module, so `jest.mock("@brelly/core", …)` replaces all of core at once —
 * the app-side tests that used to mock a single service now spread
 * `jest.requireActual("@brelly/core")` and override the names they care about.
 * That intercepts what the *app* calls. It does not intercept one core module
 * calling another, because those calls go through relative paths that never
 * pass through this file. Where a test needs that, the test belongs in the
 * package, next to the modules it is about.
 */

// Configuration the app injects — see `configureCore`.
export * from "./config";

// The data shapes everything else is written against.
export * from "./types/itinerary";
export * from "./types/routine";
export * from "./types/weather";

// Facts about the world, not about a platform.
export * from "./constants/neaRegions";

// Fetching and parsing: weather, air quality, places, and the Firestore sync layer.
export * from "./services/accountLinkService";
export * from "./services/airQuality";
export * from "./services/cloudListeners";
export * from "./services/forecastProvider";
export * from "./services/geocoding";
export * from "./services/itinerarySync";
export * from "./services/liveConditions";
export * from "./services/openMeteo";
export * from "./services/routinesSync";
export * from "./services/settingsSync";
export * from "./services/weather";
export * from "./services/widgetSnapshot";

// The zustand stores both UIs read.
export * from "./store/cloudSyncStore";
export * from "./store/itineraryStore";
export * from "./store/routineStore";
export * from "./store/settingsStore";
export * from "./store/toastStore";

// Pure functions. The bulk of the package, and the reason the extraction was affordable.
export * from "./utils/buildDigestMessage";
export * from "./utils/calendarSync";
export * from "./utils/computeNotificationTriggerTime";
export * from "./utils/dateKeys";
export * from "./utils/debounce";
export * from "./utils/derivePackingList";
export * from "./utils/describeAuthError";
export * from "./utils/describeRoutine";
export * from "./utils/describeSlotTiming";
export * from "./utils/describeUmbrella";
export * from "./utils/describeUv";
export * from "./utils/detectScheduleConflicts";
export * from "./utils/filterPlans";
export * from "./utils/forecastCache";
export * from "./utils/formatLeadTime";
export * from "./utils/formatPeriodLabel";
export * from "./utils/formatPlanDate";
export * from "./utils/formatRelativeTimestamp";
export * from "./utils/formatTempRange";
export * from "./utils/formatWind";
export * from "./utils/mergeLocalIntoAccount";
export * from "./utils/migrateSettingsDoc";
export * from "./utils/migrationFlagKey";
export * from "./utils/notificationCapWarning";
export * from "./utils/omitUndefinedFields";
export * from "./utils/otaUpdateState";
export * from "./utils/planNotificationResync";
export * from "./utils/planRoutineMaterialization";
export * from "./utils/planSelectors";
export * from "./utils/resolveColorScheme";
export * from "./utils/retargetSlotDate";
export * from "./utils/routineFrequency";
export * from "./utils/routineOccurrences";
export * from "./utils/routineSelectors";
export * from "./utils/saveWithFeedback";
export * from "./utils/shouldNotifyForRain";
export * from "./utils/shouldStackDateTimeFields";
export * from "./utils/slotKind";
export * from "./utils/slotTimeFields";
export * from "./utils/splitPlansByTime";
export * from "./utils/stripNotificationHandles";
export * from "./utils/suggestDryWindow";
export * from "./utils/timeOfDay";
export * from "./utils/weatherProvider";
export * from "./utils/wmoWeatherCode";
