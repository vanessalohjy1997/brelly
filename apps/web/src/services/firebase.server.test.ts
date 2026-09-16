/**
 * @jest-environment node
 */
const initializeFirestore = jest.fn<{ type: string }, unknown[]>(() => ({
  type: "firestore",
}));
const memoryLocalCache = jest.fn<{ kind: string }, unknown[]>(() => ({
  kind: "memory",
}));
const persistentLocalCache = jest.fn<{ kind: string }, unknown[]>(() => ({
  kind: "persistent",
}));

jest.mock("firebase/app", () => ({
  getApp: () => ({ name: "[DEFAULT]" }),
  getApps: () => [{ name: "[DEFAULT]" }],
  initializeApp: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  linkWithCredential: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  initializeFirestore: (...args: unknown[]) => initializeFirestore(...args),
  memoryLocalCache: (...args: unknown[]) => memoryLocalCache(...args),
  persistentLocalCache: (...args: unknown[]) => persistentLocalCache(...args),
  persistentMultipleTabManager: jest.fn(),
}));

/**
 * The server branch, which the jsdom suite cannot reach: there is always a
 * `window` there.
 *
 * It is a deliberate choice rather than a fallback. The persistent cache is
 * IndexedDB-backed and browser-only, so asking for it during SSR would throw on
 * every request — and a server with no cache is not a *degraded* client, so it
 * must not report itself as one. A "changes won't survive a reload" banner
 * rendered from the server on every first paint would be a lie.
 */
describe("getFirebaseFirestore during server rendering", () => {
  it("takes the memory cache on purpose, without reporting a downgrade", async () => {
    let getFirebaseFirestore!: typeof import("./firebase").getFirebaseFirestore;
    let cacheStore!: typeof import("@/store/localCacheStore").useLocalCacheStore;
    await jest.isolateModulesAsync(async () => {
      ({ getFirebaseFirestore } = await import("./firebase"));
      cacheStore = (await import("@/store/localCacheStore")).useLocalCacheStore;
    });

    getFirebaseFirestore();

    expect(initializeFirestore).toHaveBeenCalledWith(expect.anything(), {
      localCache: { kind: "memory" },
    });
    expect(persistentLocalCache).not.toHaveBeenCalled();
    expect(cacheStore.getState().mode).toBe("persistent");
  });
});

// This file has no static imports — every module under test is pulled in
// dynamically, inside an isolated registry. Without this marker TypeScript
// reads it as a global script and its top-level consts collide with the other
// file's.
export {};
