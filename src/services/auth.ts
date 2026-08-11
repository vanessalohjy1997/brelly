import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  type AuthCredential,
} from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";

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

/**
 * Runs the native Google sign-in sheet and turns the result into a Firebase
 * credential, for `linkCurrentUser`/`signInWithLinkedCredential`. Throws if
 * the user cancels — the screen's catch-all error handling covers that the
 * same way it covers a rejected link.
 */
export async function getGoogleCredential(): Promise<AuthCredential> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error("Google sign-in was cancelled");
  }
  const { idToken } = response.data;
  if (!idToken) throw new Error("Google sign-in returned no idToken");
  return GoogleAuthProvider.credential(idToken);
}

/**
 * Runs the native Apple sign-in sheet and turns the result into a Firebase
 * credential. iOS-only — callers must gate on `Platform.OS === "ios"` (Apple
 * requires it alongside Google per App Store guidelines, but it doesn't
 * exist on Android).
 */
export async function getAppleCredential(): Promise<AuthCredential> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error("Apple sign-in returned no identityToken");
  }
  return new OAuthProvider("apple.com").credential({
    idToken: credential.identityToken,
  });
}

/**
 * Same credential shape covers both "this email is new" (linking creates the
 * account) and "this email already has an account" (linking throws
 * `auth/credential-already-in-use`, the merge-required signal) — there's no
 * separate sign-up/sign-in split to make here.
 */
export function getEmailCredential(
  email: string,
  password: string,
): AuthCredential {
  return EmailAuthProvider.credential(email, password);
}
