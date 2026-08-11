import { getAuth, signInAnonymously } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";

import {
  ensureAnonymousUser,
  generateDocId,
  getFirebaseAuth,
  getFirebaseFirestore,
} from "@/services/firebase";
import { fakeFirestoreDb } from "@/test/fakeFirestore";

const mockGetAuth = getAuth as jest.Mock;
const mockSignInAnonymously = signInAnonymously as jest.Mock;
const mockGetFirestore = getFirestore as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
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
