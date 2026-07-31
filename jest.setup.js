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

jest.mock("expo-location", () => ({
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
jest.mock("@expo/ui/community/datetime-picker", () => ({
  DateTimePicker: () => null,
}));

jest.mock("expo-symbols", () => ({ SymbolView: () => null }));

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

  return {
    router,
    useRouter: () => router,
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
