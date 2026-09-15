import { linkProvider } from "./auth";

const currentUser = { uid: "anon-1", isAnonymous: true };
let user: { uid: string; isAnonymous: boolean } | null = currentUser;

jest.mock("@/services/firebase", () => ({
  getFirebaseAuth: () => ({ get currentUser() { return user; } }),
}));

const linkWithPopup = jest.fn();
const linkWithCredential = jest.fn();
const googleCredentialFromError = jest.fn();
const oauthCredentialFromError = jest.fn();
const setCustomParameters = jest.fn();
const addScope = jest.fn();

jest.mock("firebase/auth", () => ({
  EmailAuthProvider: {
    credential: (email: string, password: string) => ({
      providerId: "password",
      email,
      password,
    }),
  },
  GoogleAuthProvider: class {
    // Annotated rather than inferred: an inferred static that calls out to a
    // `jest.fn` reads to the compiler as self-referential (TS7022).
    static credentialFromError: (error: unknown) => unknown = (error) =>
      googleCredentialFromError(error);
    providerId = "google.com";
    setCustomParameters = setCustomParameters;
  },
  OAuthProvider: class {
    static credentialFromError: (error: unknown) => unknown = (error) =>
      oauthCredentialFromError(error);
    constructor(public providerId: string) {}
    addScope = addScope;
  },
  linkWithPopup: (...args: unknown[]) => linkWithPopup(...args),
  linkWithCredential: (...args: unknown[]) => linkWithCredential(...args),
}));

const alreadyInUse = Object.assign(new Error("in use"), {
  code: "auth/credential-already-in-use",
});
const emailInUse = Object.assign(new Error("in use"), {
  code: "auth/email-already-in-use",
});

beforeEach(() => {
  jest.clearAllMocks();
  user = currentUser;
  linkWithPopup.mockResolvedValue({ user: currentUser });
  linkWithCredential.mockResolvedValue({ user: currentUser });
});

describe("linkProvider", () => {
  it("links a brand-new Google identity onto the current uid", async () => {
    await expect(linkProvider({ provider: "google" })).resolves.toEqual({
      status: "linked",
    });
    // The account chooser is forced: a browser with exactly one Google session
    // would otherwise sign straight back into the account just signed out of.
    expect(setCustomParameters).toHaveBeenCalledWith({
      prompt: "select_account",
    });
  });

  it("asks Apple for the scopes the account screen displays", async () => {
    await expect(linkProvider({ provider: "apple" })).resolves.toEqual({
      status: "linked",
    });
    expect(addScope.mock.calls.flat()).toEqual(["email", "name"]);
  });

  it("links a brand-new email identity", async () => {
    await expect(
      linkProvider({
        provider: "email",
        email: "new@example.com",
        password: "hunter2",
      }),
    ).resolves.toEqual({ status: "linked" });
    expect(linkWithCredential).toHaveBeenCalledWith(
      currentUser,
      expect.objectContaining({ email: "new@example.com" }),
    );
  });

  it("hands back the credential recovered from the rejection", async () => {
    // The credential is the whole point of the return value. The merge that
    // follows has to switch identity with *this* one after it has deleted the
    // anonymous user's documents — and a second popup there would be issued
    // after an `await`, outside the user-gesture task, and blocked.
    linkWithPopup.mockRejectedValueOnce(alreadyInUse);
    googleCredentialFromError.mockReturnValueOnce({
      providerId: "google.com",
      idToken: "recovered",
    });

    await expect(linkProvider({ provider: "google" })).resolves.toEqual({
      status: "merge-required",
      credential: { providerId: "google.com", idToken: "recovered" },
    });
  });

  it("recovers an Apple credential through the OAuth static, not Google's", async () => {
    linkWithPopup.mockRejectedValueOnce(alreadyInUse);
    oauthCredentialFromError.mockReturnValueOnce({
      providerId: "apple.com",
      idToken: "recovered-apple",
    });

    await expect(linkProvider({ provider: "apple" })).resolves.toEqual({
      status: "merge-required",
      credential: { providerId: "apple.com", idToken: "recovered-apple" },
    });
    expect(googleCredentialFromError).not.toHaveBeenCalled();
  });

  it("rethrows when the rejection carries no credential to merge with", async () => {
    // "Already in use" with nothing to merge *with* leaves the caller no way
    // to complete the identity switch. Reporting merge-required anyway would
    // send it into a flow that deletes the anonymous documents first.
    linkWithPopup.mockRejectedValueOnce(alreadyInUse);
    googleCredentialFromError.mockReturnValueOnce(null);

    await expect(linkProvider({ provider: "google" })).rejects.toThrow(
      "in use",
    );
  });

  it("reads auth/email-already-in-use as merge-required too", async () => {
    // The email provider spells the same situation with a different code, and
    // matching only the OAuth one is why the email flow could never reach the
    // merge. `credentialFromError` is an OAuth-only static and returns null
    // here, so the credential is rebuilt from the inputs instead.
    linkWithCredential.mockRejectedValueOnce(emailInUse);

    await expect(
      linkProvider({
        provider: "email",
        email: "taken@example.com",
        password: "hunter2",
      }),
    ).resolves.toEqual({
      status: "merge-required",
      credential: {
        providerId: "password",
        email: "taken@example.com",
        password: "hunter2",
      },
    });
    expect(googleCredentialFromError).not.toHaveBeenCalled();
    expect(oauthCredentialFromError).not.toHaveBeenCalled();
  });

  it("surfaces a disabled provider rather than starting a merge", async () => {
    // The distinction the codes exist for. `auth/operation-not-allowed` means
    // email sign-in is switched off in the Firebase console — a configuration
    // fault the user can do nothing about — and reading it as "merge required"
    // would delete the anonymous user's documents on the way to an identity
    // switch that cannot happen.
    linkWithCredential.mockRejectedValueOnce(
      Object.assign(new Error("nope"), { code: "auth/operation-not-allowed" }),
    );

    await expect(
      linkProvider({ provider: "email", email: "x@example.com", password: "pw" }),
    ).rejects.toMatchObject({ code: "auth/operation-not-allowed" });
  });

  it("refuses to link with no session at all", async () => {
    user = null;

    await expect(linkProvider({ provider: "google" })).rejects.toThrow(
      "No current user to link",
    );
    expect(linkWithPopup).not.toHaveBeenCalled();
  });
});
