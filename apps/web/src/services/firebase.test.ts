// The argument type is declared rather than inferred: `jest.fn(() => …)`
// infers a zero-argument signature, and the module factory below forwards
// through a spread.
const initializeFirestore = jest.fn<{ type: string }, unknown[]>(() => ({
  type: "firestore",
}));
const persistentLocalCache = jest.fn<{ kind: string }, unknown[]>(() => ({
  kind: "persistent",
}));
const persistentMultipleTabManager = jest.fn<{ kind: string }, unknown[]>(
  () => ({ kind: "multi-tab" }),
);
const memoryLocalCache = jest.fn<{ kind: string }, unknown[]>(() => ({
  kind: "memory",
}));

jest.mock("firebase/app", () => ({
  getApp: () => ({ name: "[DEFAULT]" }),
  getApps: () => [{ name: "[DEFAULT]" }],
  initializeApp: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  linkWithCredential: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({ id: "generated-id" })),
  initializeFirestore: (...args: unknown[]) => initializeFirestore(...args),
  memoryLocalCache: (...args: unknown[]) => memoryLocalCache(...args),
  persistentLocalCache: (...args: unknown[]) => persistentLocalCache(...args),
  persistentMultipleTabManager: (...args: unknown[]) =>
    persistentMultipleTabManager(...args),
}));

/**
 * `getFirebaseFirestore` memoises, deliberately — `initializeFirestore` may
 * only be called once per app — so each case re-imports the module to get a
 * fresh one rather than reaching for a reset the real SDK has no equivalent of.
 *
 * The cache store comes back from inside the same isolated registry, and that
 * is not incidental: an isolated module graph gets its *own* copy of every
 * module it imports, so a store imported at the top of this file would be a
 * different store from the one the module under test writes to — and every
 * assertion about the downgrade would read the untouched one.
 */
async function freshModule() {
  let mod!: typeof import("./firebase");
  let cacheStore!: typeof import("@/store/localCacheStore").useLocalCacheStore;
  await jest.isolateModulesAsync(async () => {
    mod = await import("./firebase");
    cacheStore = (await import("@/store/localCacheStore")).useLocalCacheStore;
  });
  return { ...mod, cacheStore };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getFirebaseFirestore", () => {
  it("asks for the persistent cache, multi-tab", async () => {
    // Without this the web SDK defaults to a memory-only cache, and the code
    // both apps share relies on Firestore applying writes locally whatever the
    // network is doing — so an offline edit would be gone on reload with no
    // error. Multi-tab rather than the single-tab default because two Brelly
    // tabs is an ordinary thing to have open.
    const { getFirebaseFirestore, cacheStore } = await freshModule();
    getFirebaseFirestore();

    expect(persistentMultipleTabManager).toHaveBeenCalled();
    expect(persistentLocalCache).toHaveBeenCalledWith({
      tabManager: { kind: "multi-tab" },
    });
    expect(initializeFirestore).toHaveBeenCalledWith(expect.anything(), {
      localCache: { kind: "persistent" },
    });
    expect(cacheStore.getState().mode).toBe("persistent");
  });

  it("falls back to the memory cache and says so when persistence is refused", async () => {
    // Safari's private mode and Firefox's ETP refuse IndexedDB outright. At
    // module scope that would white-screen the app; here it downgrades, and
    // the downgrade is recorded so the UI can say that changes will not
    // survive a reload.
    initializeFirestore.mockImplementationOnce(() => {
      throw new Error("IndexedDB is not available");
    });

    const { getFirebaseFirestore, cacheStore } = await freshModule();
    getFirebaseFirestore();

    expect(memoryLocalCache).toHaveBeenCalled();
    expect(cacheStore.getState()).toMatchObject({
      mode: "memory",
      reason: "IndexedDB is not available",
    });
  });

  it("records a non-Error rejection as text rather than losing it", async () => {
    // Firefox's ETP rejects with a DOMException, and some builds throw a bare
    // string. `String(error)` keeps the reason readable in the console either
    // way; dropping it would leave a downgrade with no explanation at all.
    initializeFirestore.mockImplementationOnce(() => {
      throw "SecurityError";
    });

    const { getFirebaseFirestore, cacheStore } = await freshModule();
    getFirebaseFirestore();

    expect(cacheStore.getState()).toMatchObject({
      mode: "memory",
      reason: "SecurityError",
    });
  });

  it("constructs the instance once and reuses it", async () => {
    // `initializeFirestore` throws if called twice for one app, so a second
    // caller must get the memoised instance rather than a second attempt.
    const { getFirebaseFirestore } = await freshModule();

    expect(getFirebaseFirestore()).toBe(getFirebaseFirestore());
    expect(initializeFirestore).toHaveBeenCalledTimes(1);
  });
});

describe("generateDocId", () => {
  it("mints an id with no network round trip", async () => {
    const { generateDocId } = await freshModule();
    expect(generateDocId()).toBe("generated-id");
  });
});

describe("ensureAnonymousUser", () => {
  it("signs in when no session survived", async () => {
    const { getAuth } = jest.requireMock("firebase/auth");
    const { signInAnonymously } = jest.requireMock("firebase/auth");
    getAuth.mockReturnValue({ currentUser: null });

    const { ensureAnonymousUser } = await freshModule();
    await ensureAnonymousUser();

    expect(signInAnonymously).toHaveBeenCalled();
  });

  it("resolves from the stored session without a second sign-in", async () => {
    const { getAuth, signInAnonymously } = jest.requireMock("firebase/auth");
    getAuth.mockReturnValue({ currentUser: { uid: "anon-1" } });

    const { ensureAnonymousUser } = await freshModule();
    await ensureAnonymousUser();

    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});

describe("linkCurrentUser", () => {
  it("links onto the current user, preserving its uid", async () => {
    const { getAuth, linkWithCredential } = jest.requireMock("firebase/auth");
    getAuth.mockReturnValue({ currentUser: { uid: "anon-1" } });

    const { linkCurrentUser } = await freshModule();
    const credential = { providerId: "google.com" } as never;
    linkCurrentUser(credential);

    expect(linkWithCredential).toHaveBeenCalledWith(
      { uid: "anon-1" },
      credential,
    );
  });

  it("refuses with no session rather than creating one", async () => {
    const { getAuth } = jest.requireMock("firebase/auth");
    getAuth.mockReturnValue({ currentUser: null });

    const { linkCurrentUser } = await freshModule();
    expect(() => linkCurrentUser({} as never)).toThrow(
      "No current user to link",
    );
  });
});

describe("the remaining session wrappers", () => {
  it("switch identity, end the session, and stream the current user", async () => {
    const { getAuth, signInWithCredential, signOut, onAuthStateChanged } =
      jest.requireMock("firebase/auth");
    const auth = { currentUser: { uid: "anon-1" } };
    getAuth.mockReturnValue(auth);
    onAuthStateChanged.mockReturnValue(() => {});

    const mod = await freshModule();
    const credential = { providerId: "password" } as never;
    const onChange = jest.fn();

    mod.signInWithLinkedCredential(credential);
    mod.signOutCurrentUser();
    mod.subscribeToAuthUser(onChange);

    expect(signInWithCredential).toHaveBeenCalledWith(auth, credential);
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(onAuthStateChanged).toHaveBeenCalledWith(auth, onChange);
    expect(mod.getFirebaseAuth()).toBe(auth);
  });
});

// This file has no static imports — every module under test is pulled in
// dynamically, inside an isolated registry. Without this marker TypeScript
// reads it as a global script and its top-level consts collide with the other
// file's.
export {};
