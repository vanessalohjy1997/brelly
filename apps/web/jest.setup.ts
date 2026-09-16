import "@testing-library/jest-dom";

// Core refuses to run unconfigured, so this suite is an entry point like any
// other and configures it the way `src/app/providers.tsx` does. Reached by its
// own path rather than through `@brelly/core`: the barrel is `export *` over
// the whole package, so requiring it here would instantiate every core module
// before any test file's `jest.mock` factory runs, and a module already in the
// registry keeps the real bindings it closed over.
//
// The `proxy` arm carries no key by construction — that is the point of the
// union — so unlike the mobile suite there is no fixture key here to leak.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../../packages/core/src/config").configureCore({
  places: { mode: "proxy", placesPath: "/api/places", geocodePath: "/api/places/geocode" },
});

/**
 * The two SDKs, faked globally — the same thing `apps/mobile/jest.setup.js`
 * does for `@react-native-firebase/*`, and with the *same* fakes: they live in
 * `@brelly/core/test` precisely because both apps need them and neither owns
 * them, and what they model is the modular API the two SDKs share.
 *
 * Global rather than per-file because the reach is transitive and invisible:
 * `useItineraryStore.addSlot` writes through the sync layer, so any test that
 * so much as adds a stop ends up in `getAuth()` and fails on
 * `auth/invalid-api-key`. A file that is *about* one of these modules declares
 * its own `jest.mock` and overrides this.
 */
jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({ name: "[DEFAULT]" })),
  getApp: jest.fn(() => ({ name: "[DEFAULT]" })),
  getApps: jest.fn(() => [{ name: "[DEFAULT]" }]),
}));

jest.mock("firebase/auth", () => {
  const { createAuthMock } = jest.requireActual("@brelly/core/test");
  return {
    ...createAuthMock(),
    // Web-only, and the shape that matters is the *return*: `linkWithPopup` is
    // the acquisition and the link in one call, which is the whole reason the
    // auth seam takes an intent rather than handing out a credential.
    linkWithPopup: jest.fn(async () => ({ user: null })),
    signInWithPopup: jest.fn(async () => ({ user: null })),
  };
});

jest.mock("firebase/firestore", () => {
  const { createFirestoreMock, fakeFirestoreDb } =
    jest.requireActual("@brelly/core/test");
  return {
    ...createFirestoreMock(),
    // The cache configuration has no behaviour to fake — what it decides is
    // where IndexedDB lives, and there is none here. `services/firebase.test.ts`
    // is where the choice between them is actually asserted.
    initializeFirestore: jest.fn(() => fakeFirestoreDb),
    memoryLocalCache: jest.fn(() => ({ kind: "memory" })),
    persistentLocalCache: jest.fn(() => ({ kind: "persistent" })),
    persistentMultipleTabManager: jest.fn(() => ({ kind: "multi-tab" })),
  };
});
