/* eslint-env jest */

// Gesture Handler and Reanimated both reach for native modules at import
// time. Gesture Handler ships a usable test double; Reanimated 4's own
// `mock.js` re-imports the real entry point (and so still throws), so it has a
// local stand-in in `__mocks__/react-native-reanimated.js`. That file needs no
// `jest.mock` call: a `__mocks__` directory adjacent to node_modules is
// applied to node modules automatically (and calling `jest.mock` with a
// factory that requires it makes the resolver recurse into itself).
require("react-native-gesture-handler/jestSetup");

// Native modules that have no JS implementation in the Jest environment.
// Without these, importing *any* component that transitively reaches the
// stores or the notification service fails at module load — which is why
// components in this repo were previously untestable. See PLAN.md.

// react-native-mmkv is backed by Nitro, whose TurboModule isn't registered in
// tests. An in-memory map satisfies the localStorage-like surface that the
// zustand `persist` adapter in src/store/mmkvStorage.ts uses.
jest.mock("react-native-mmkv", () => {
  const store = new Map();
  return {
    createMMKV: () => ({
      getString: (key) => (store.has(key) ? store.get(key) : undefined),
      set: (key, value) => store.set(key, value),
      remove: (key) => store.delete(key),
      clearAll: () => store.clear(),
    }),
  };
});

// @react-native-firebase/auth is native-backed the same way. Only the
// modular functions src/services/firebase.ts and src/services/auth.ts
// actually call are faked, per FIREBASE_MIGRATION.md's testing section — the
// namespaced API doesn't exist in the installed SDK, so there's nothing to
// fake beyond these. Stateful (a mutable `currentUser`, an
// already-in-use registry) because phase 5's account linking needs to
// simulate a credential swap mid-test — see src/test/fakeAuth.ts.
jest.mock("@react-native-firebase/auth", () =>
  require("./src/test/fakeAuth").createAuthMock(),
);

// GoogleSignin and expo-apple-authentication are native-backed too, and only
// used from src/services/auth.ts's credential builders. auth.test.ts
// overrides this locally for the one function it exercises directly.
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      type: "success",
      data: { idToken: "test-google-id-token", user: {} },
    }),
  },
  isSuccessResponse: jest.fn(
    (response) => response?.type === "success",
  ),
}));

jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest
    .fn()
    .mockResolvedValue({ identityToken: "test-apple-identity-token" }),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// @react-native-firebase/firestore is native-backed too, and — per
// FIREBASE_MIGRATION.md — the installed SDK's modular entry point has no
// chained `collection().doc().set()` API left to fake, only the standalone
// functions in src/test/fakeFirestore.ts.
jest.mock("@react-native-firebase/firestore", () =>
  require("./src/test/fakeFirestore").createFirestoreMock(),
);

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue("notif-test"),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date", DAILY: "daily" },
  AndroidImportance: { DEFAULT: 3 },
}));

// The calendar is a real second store of the user's data, so the default here
// is "permission granted, one writable calendar, nothing in it" — enough for
// any screen that merely mounts the sync hook, and a test that cares supplies
// its own events.
jest.mock("expo-calendar", () => ({
  getCalendarPermissions: jest
    .fn()
    .mockResolvedValue({ granted: true, canAskAgain: false }),
  requestCalendarPermissions: jest
    .fn()
    .mockResolvedValue({ granted: true, canAskAgain: false }),
  getCalendars: jest.fn().mockResolvedValue([]),
  listEvents: jest.fn().mockResolvedValue([]),
  EntityTypes: { EVENT: "event", REMINDER: "reminder" },
}));

jest.mock("expo-location", () => ({
  // `useNearbyForecast` reads the status without prompting on mount and only
  // calls `request…` from an explicit affordance — so both have to exist.
  getForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest
    .fn()
    .mockResolvedValue({ coords: { latitude: 1.3521, longitude: 103.8198 } }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([]),
  Accuracy: { Highest: 6, Balanced: 3 },
}));

// The native date/time picker renders nothing useful under test; a stub keeps
// SlotForm mountable while leaving its own fields interactive.
//
// It does forward `themeVariant`, though. That prop is the only thing keeping
// the picker in the app's theme rather than the device's — SwiftUI reads the
// `colorScheme` environment, not our `Colors` — and it is exactly the kind of
// prop that gets dropped in a refactor without anything looking broken until
// someone opens the form on the dark theme over a light system.
//
// `mode` and `onValueChange` are forwarded too, so a test can tell the Day
// picker from the Starts and Ends ones and drive each of them — which is the
// only way to check that changing the day carries both times along.
jest.mock("@expo/ui/community/datetime-picker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    DateTimePicker: ({ themeVariant, mode, value, onValueChange }) =>
      React.createElement(View, {
        testID: `datetime-picker-${mode ?? "date"}`,
        themeVariant,
        mode,
        value,
        // The real picker's first argument is a native change event nobody
        // reads; the date is the second.
        onValueChange: (date) =>
          onValueChange?.({ nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } }, date),
      }),
  };
});

// SymbolView has no JS implementation under Jest. A stand-in that renders a
// View tagged with the symbol's name is what makes icon-only information
// testable — the umbrella verdict is carried by *which* glyphs are on screen,
// so a mock returning null would leave that unverifiable.
jest.mock("expo-symbols", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    // `size` is folded into the style the way the real SymbolView sizes
    // itself, so a test can tell a raindrop from the umbrella it falls on.
    SymbolView: ({ name, accessibilityLabel, style, size }) =>
      React.createElement(View, {
        testID: `symbol-${typeof name === "string" ? name : name?.android}`,
        accessibilityLabel,
        style: [style, size === undefined ? null : { width: size, height: size }],
      }),
  };
});

jest.mock("expo-router", () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    dismiss: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
  };
  const Stack = () => null;
  Stack.Screen = () => null;
  Stack.Toolbar = Object.assign(() => null, { Button: () => null });

  // Shared across the mock so a test can assert on what a screen set — the
  // unsaved-changes guard turns the modal's swipe-to-dismiss off through
  // `setOptions({ gestureEnabled })`, and that is the only trace it leaves.
  const navigation = {
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
    goBack: jest.fn(),
  };

  return {
    router,
    useRouter: () => router,
    useNavigation: () => navigation,
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: () => [],
    usePathname: () => "/",
    useFocusEffect: jest.fn(),
    Link: ({ children }) => children,
    Stack,
    ThemeProvider: ({ children }) => children,
    DarkTheme: {},
    DefaultTheme: {},
  };
});
