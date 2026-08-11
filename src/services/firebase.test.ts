import { getAuth, GoogleAuthProvider, signInAnonymously } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";

import {
  ensureAnonymousUser,
  generateDocId,
  getFirebaseAuth,
  getFirebaseFirestore,
  linkCurrentUser,
  signInWithLinkedCredential,
  subscribeToAuthUser,
} from "@/services/firebase";
import { fakeAuth } from "@/test/fakeAuth";
import { fakeFirestoreDb } from "@/test/fakeFirestore";

const mockGetAuth = getAuth as jest.Mock;
const mockSignInAnonymously = signInAnonymously as jest.Mock;
const mockGetFirestore = getFirestore as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fakeAuth.reset();
  fakeFirestoreDb.reset();
  mockGetAuth.mockReturnValue({ currentUser: null });
  mockSignInAnonymously.mockResolvedValue({
    user: { uid: "test-uid", isAnonymous: true },
  });
});

describe("getFirebaseAuth", () => {
  it("resolves the default app's auth instance", () => {
    getFirebaseAuth();

    expect(mockGetAuth).toHaveBeenCalledWith();
  });
});

describe("getFirebaseFirestore", () => {
  it("resolves the default app's firestore instance", () => {
    getFirebaseFirestore();

    expect(mockGetFirestore).toHaveBeenCalledWith();
  });
});

describe("ensureAnonymousUser", () => {
  it("signs in anonymously when no user is signed in", async () => {
    await ensureAnonymousUser();

    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("does nothing when a user is already signed in", async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: "existing" } });

    await ensureAnonymousUser();

    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });
});

describe("generateDocId", () => {
  it("returns a truthy id", () => {
    expect(generateDocId()).toBeTruthy();
  });

  it("never returns the same id twice", () => {
    const first = generateDocId();
    const second = generateDocId();

    expect(first).not.toBe(second);
  });
});

describe("linkCurrentUser", () => {
  it("links a credential onto the current user", async () => {
    mockGetAuth.mockReturnValue(fakeAuth);
    fakeAuth.setCurrentUser({ uid: "anon", isAnonymous: true });

    await linkCurrentUser(GoogleAuthProvider.credential("token"));

    expect(fakeAuth.currentUser?.isAnonymous).toBe(false);
  });

  it("throws when there is no current user to link", () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    expect(() =>
      linkCurrentUser(GoogleAuthProvider.credential("token")),
    ).toThrow("No current user to link");
  });
});

describe("signInWithLinkedCredential", () => {
  it("switches the session to the credential's account", async () => {
    mockGetAuth.mockReturnValue(fakeAuth);
    const credential = GoogleAuthProvider.credential("token");
    fakeAuth.registerExistingAccount(credential, {
      uid: "existing",
      isAnonymous: false,
    });

    await signInWithLinkedCredential(credential);

    expect(fakeAuth.currentUser?.uid).toBe("existing");
  });
});

describe("subscribeToAuthUser", () => {
  it("calls back with the current user immediately, and again on change", () => {
    mockGetAuth.mockReturnValue(fakeAuth);
    fakeAuth.setCurrentUser({ uid: "u1", isAnonymous: true });
    const onChange = jest.fn();

    subscribeToAuthUser(onChange);
    expect(onChange).toHaveBeenLastCalledWith({ uid: "u1", isAnonymous: true });

    fakeAuth.setCurrentUser({ uid: "u2", isAnonymous: false });
    expect(onChange).toHaveBeenLastCalledWith({ uid: "u2", isAnonymous: false });
  });

  it("returns an unsubscribe function", () => {
    mockGetAuth.mockReturnValue(fakeAuth);
    const onChange = jest.fn();

    const unsubscribe = subscribeToAuthUser(onChange);
    unsubscribe();
    onChange.mockClear();
    fakeAuth.setCurrentUser({ uid: "u3", isAnonymous: true });

    expect(onChange).not.toHaveBeenCalled();
  });
});
