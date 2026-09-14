import { linkProvider } from "@brelly/platform/auth";
import { fakeAuth, type FakeCredential } from "@brelly/core/test";

const account = { uid: "existing", isAnonymous: false, email: "taken@example.com" };

beforeEach(() => {
  jest.clearAllMocks();
  fakeAuth.reset();
  fakeAuth.setCurrentUser({ uid: "anon-1", isAnonymous: true });
});

describe("linkProvider", () => {
  it("links a brand-new Google identity onto the current uid", async () => {
    await expect(linkProvider({ provider: "google" })).resolves.toEqual({
      status: "linked",
    });
    expect(fakeAuth.currentUser).toMatchObject({
      uid: "anon-1",
      isAnonymous: false,
    });
  });

  it("links a brand-new Apple identity", async () => {
    await expect(linkProvider({ provider: "apple" })).resolves.toEqual({
      status: "linked",
    });
  });

  it("links a brand-new email identity", async () => {
    await expect(
      linkProvider({
        provider: "email",
        email: "new@example.com",
        password: "hunter2",
      }),
    ).resolves.toEqual({ status: "linked" });
    expect(fakeAuth.currentUser).toMatchObject({ email: "new@example.com" });
  });

  it("hands the credential back when the identity already has an account", async () => {
    fakeAuth.registerExistingAccount(
      { providerId: "google.com", idToken: "test-google-id-token" },
      account,
    );

    const outcome = await linkProvider({ provider: "google" });

    // The credential is the whole point of the return value: the merge that
    // follows has to switch identity with *this* credential, after it has
    // deleted the anonymous user's documents. Re-running the provider sheet
    // there would be a second sheet on native and a blocked popup on web.
    expect(outcome).toEqual({
      status: "merge-required",
      credential: expect.objectContaining({ idToken: "test-google-id-token" }),
    });
  });

  it("reads auth/email-already-in-use as merge-required too", async () => {
    // The email provider spells the same situation with a different code, and
    // matching only the OAuth one is why the email flow could never reach the
    // merge — it surfaced as a flat "Couldn't back up your data" instead.
    fakeAuth.registerExistingAccount(
      { providerId: "password", email: "taken@example.com", password: "hunter2" },
      account,
    );

    const outcome = await linkProvider({
      provider: "email",
      email: "taken@example.com",
      password: "hunter2",
    });

    expect(outcome).toMatchObject({ status: "merge-required" });
  });

  it("rethrows anything that is not the already-in-use signal", async () => {
    fakeAuth.setCurrentUser(null);

    await expect(linkProvider({ provider: "google" })).rejects.toThrow(
      "No current user to link",
    );
  });

  it("surfaces a disabled provider rather than starting a merge", async () => {
    // The distinction the codes exist for. `auth/operation-not-allowed` means
    // email sign-in is switched off in the Firebase console — a
    // configuration fault the user can do nothing about — and reading it as
    // "merge required" would delete the anonymous user's documents on the way
    // to an identity switch that cannot happen.
    jest
      .spyOn(fakeAuth, "linkWithCredential")
      .mockRejectedValueOnce(
        Object.assign(new Error("nope"), { code: "auth/operation-not-allowed" }),
      );

    await expect(
      linkProvider({ provider: "email", email: "x@example.com", password: "pw" }),
    ).rejects.toMatchObject({ code: "auth/operation-not-allowed" });
  });

  it("rethrows a cancelled provider sheet without attempting a link", async () => {
    const { GoogleSignin } = jest.requireMock(
      "@react-native-google-signin/google-signin",
    );
    GoogleSignin.signIn.mockResolvedValueOnce({ type: "cancelled" });

    await expect(linkProvider({ provider: "google" })).rejects.toThrow(
      "Google sign-in was cancelled",
    );

    const { linkWithCredential } = jest.requireMock(
      "@react-native-firebase/auth",
    ) as { linkWithCredential: jest.Mock };
    expect(linkWithCredential).not.toHaveBeenCalled();
  });
});

// Kept honest about what the fake's credential shape is, so a change to it
// fails here rather than in the merge tests three files away.
const _typecheck: FakeCredential = { providerId: "google.com" };
void _typecheck;
