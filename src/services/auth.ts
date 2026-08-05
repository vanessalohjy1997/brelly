import { GoogleSignin } from "@react-native-google-signin/google-signin";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!;

/**
 * Must run once, before any other GoogleSignin call. `webClientId` is the
 * "Web client (auto created by Google Service)" OAuth client Firebase
 * generated when Google was enabled as a sign-in provider — that's the
 * correct one even on native builds; the separate Android/iOS OAuth clients
 * (tied to package name + SHA-1 / bundle ID) aren't used here.
 */
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
}
