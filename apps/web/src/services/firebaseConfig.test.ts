/**
 * The cold-start branch of `firebaseApp()`, which needs `getApps()` to be
 * empty — the suite next door mocks it as already-initialised, so
 * `initializeApp` is never reached there.
 */
// The argument type is declared rather than inferred: `jest.fn(() => …)`
// infers a zero-argument signature, and the module factory below forwards
// through a spread.
const initializeApp = jest.fn<{ name: string }, unknown[]>(() => ({
  name: "[DEFAULT]",
}));

jest.mock("firebase/app", () => ({
  getApp: jest.fn(() => ({ name: "[DEFAULT]" })),
  getApps: jest.fn(() => []),
  initializeApp: (...args: unknown[]) => initializeApp(...args),
}));

const ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const original = { ...process.env };

/**
 * The config is read at module scope, so each case needs the module graph torn
 * down and rebuilt around the environment it is testing.
 */
async function loadWithEnv(env: Partial<Record<string, string | undefined>>) {
  jest.resetModules();
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  return import("./firebase");
}

const COMPLETE = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIza-test",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "brelly.web.app",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "brelly-50de6",
};

beforeEach(() => {
  initializeApp.mockClear();
});

afterEach(() => {
  process.env = { ...original };
});

describe("firebaseApp configuration", () => {
  it("names the variable that is missing, not the key that is invalid", async () => {
    // An unset `NEXT_PUBLIC_*` is not a variable that reads as empty — it is
    // the string `undefined` handed to the SDK, which answers
    // `auth/invalid-api-key` four frames deep in bootstrap and points at
    // Firebase rather than at the deploy.
    const { getFirebaseAuth } = await loadWithEnv({});

    expect(() => getFirebaseAuth()).toThrow(
      /NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID are unset/,
    );
  });

  it("says where the values come from", async () => {
    const { getFirebaseAuth } = await loadWithEnv({});

    expect(() => getFirebaseAuth()).toThrow(/apps\/web\/\.env\.local/);
  });

  it("names just the one that is missing, in the singular", async () => {
    const { getFirebaseAuth } = await loadWithEnv({
      ...COMPLETE,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: undefined,
    });

    expect(() => getFirebaseAuth()).toThrow(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is unset",
    );
  });

  it("treats an empty value as unset, because a blank .env line is the usual way in", async () => {
    const { getFirebaseAuth } = await loadWithEnv({
      ...COMPLETE,
      NEXT_PUBLIC_FIREBASE_API_KEY: "",
    });

    expect(() => getFirebaseAuth()).toThrow("NEXT_PUBLIC_FIREBASE_API_KEY");
  });

  it("does not demand the two values this app never reads", async () => {
    // Nothing here uploads a file or sends a message, so requiring
    // `storageBucket` and `messagingSenderId` would block a working dev setup
    // on values with no caller.
    const { getFirebaseAuth } = await loadWithEnv(COMPLETE);

    expect(() => getFirebaseAuth()).not.toThrow();
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "AIza-test" }),
    );
  });
});
