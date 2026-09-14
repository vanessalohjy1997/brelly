import { authErrorCode, describeAuthError } from "./describeAuthError";

describe("authErrorCode", () => {
  it("reads the code off a Firebase error", () => {
    expect(authErrorCode({ code: "auth/invalid-email" })).toBe(
      "auth/invalid-email",
    );
  });

  it("returns null for anything without a string code", () => {
    expect(authErrorCode(new Error("network"))).toBeNull();
    expect(authErrorCode(null)).toBeNull();
    expect(authErrorCode("auth/invalid-email")).toBeNull();
    expect(authErrorCode({ code: 42 })).toBeNull();
  });
});

describe("describeAuthError", () => {
  it("names a disabled email/password provider, the one failure only a console change fixes", () => {
    expect(describeAuthError({ code: "auth/operation-not-allowed" })).toBe(
      "Email sign-in isn't turned on for this app",
    );
  });

  it("distinguishes a bad address from a bad password", () => {
    expect(describeAuthError({ code: "auth/invalid-email" })).toBe(
      "That email address doesn't look right",
    );
    expect(describeAuthError({ code: "auth/wrong-password" })).toContain(
      "password doesn't match",
    );
  });

  it("treats invalid-credential as a wrong password, which is what it means since Firebase stopped returning wrong-password", () => {
    expect(describeAuthError({ code: "auth/invalid-credential" })).toBe(
      describeAuthError({ code: "auth/wrong-password" }),
    );
  });

  it("covers weak passwords, disabled accounts, throttling and offline", () => {
    expect(describeAuthError({ code: "auth/weak-password" })).toContain(
      "6 characters",
    );
    expect(describeAuthError({ code: "auth/user-disabled" })).toBe(
      "That account has been disabled",
    );
    expect(describeAuthError({ code: "auth/too-many-requests" })).toContain(
      "wait a minute",
    );
    expect(describeAuthError({ code: "auth/network-request-failed" })).toContain(
      "No connection",
    );
  });

  it("falls back to the generic message for an unknown failure", () => {
    expect(describeAuthError(new Error("boom"))).toBe(
      "Couldn't back up your data",
    );
    expect(describeAuthError({ code: "auth/internal-error" })).toBe(
      "Couldn't back up your data",
    );
  });
});
