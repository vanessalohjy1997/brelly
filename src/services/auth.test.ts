import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { configureGoogleSignIn } from "@/services/auth";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: { configure: jest.fn() },
}));

describe("configureGoogleSignIn", () => {
  it("configures GoogleSignin with the web client ID from the environment", () => {
    configureGoogleSignIn();

    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
  });
});
