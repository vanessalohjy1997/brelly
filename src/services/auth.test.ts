import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

import {
  configureGoogleSignIn,
  getAppleCredential,
  getEmailCredential,
  getGoogleCredential,
} from "@/services/auth";

const mockSignIn = GoogleSignin.signIn as jest.Mock;
const mockSignInAsync = AppleAuthentication.signInAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("configureGoogleSignIn", () => {
  it("configures GoogleSignin with the web client ID from the environment", () => {
    configureGoogleSignIn();

    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
  });
});

describe("getGoogleCredential", () => {
  it("builds a Google credential from the signed-in idToken", async () => {
    mockSignIn.mockResolvedValue({
      type: "success",
      data: { idToken: "google-id-token" },
    });

    const credential = await getGoogleCredential();

    expect(credential).toMatchObject({ idToken: "google-id-token" });
  });

  it("throws when the sign-in sheet is cancelled", async () => {
    mockSignIn.mockResolvedValue({ type: "cancelled" });

    await expect(getGoogleCredential()).rejects.toThrow(
      "Google sign-in was cancelled",
    );
  });

  it("throws when the response has no idToken", async () => {
    mockSignIn.mockResolvedValue({ type: "success", data: { idToken: null } });

    await expect(getGoogleCredential()).rejects.toThrow(
      "Google sign-in returned no idToken",
    );
  });
});

describe("getAppleCredential", () => {
  it("builds an Apple credential from the signed-in identityToken", async () => {
    mockSignInAsync.mockResolvedValue({
      identityToken: "apple-identity-token",
    });

    const credential = await getAppleCredential();

    expect(credential).toMatchObject({ idToken: "apple-identity-token" });
  });

  it("throws when the response has no identityToken", async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null });

    await expect(getAppleCredential()).rejects.toThrow(
      "Apple sign-in returned no identityToken",
    );
  });
});

describe("getEmailCredential", () => {
  it("builds an email/password credential", () => {
    const credential = getEmailCredential("person@example.com", "hunter2");

    expect(credential).toMatchObject({
      email: "person@example.com",
      password: "hunter2",
    });
  });
});
