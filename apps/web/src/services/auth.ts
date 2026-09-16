import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  linkWithCredential,
  linkWithPopup,
  type AuthCredential,
  type AuthProvider,
} from "firebase/auth";

import { authErrorCode } from "@brelly/core";
import { getFirebaseAuth } from "@/services/firebase";

/**
 * The web fork of `services/auth.ts`.
 *
 * The mobile file exports three credential *builders* and lets
 * `platform/auth.ts` link them afterwards. There is no web equivalent of that
 * split for the OAuth providers: `linkWithPopup` is the acquisition and the
 * link in one call, and there is no earlier moment at which a credential
 * exists. So the acquire-then-link shape lives here in whole rather than being
 * assembled by the seam, and the seam's job shrinks to naming the intent.
 *
 * Note what is missing compared to mobile. There is no `configureGoogleSignIn`
 * and no `googleWebClientId`: the popup flow reads its client from the Firebase
 * project, which is why that value was deliberately kept out of `CoreConfig`.
 */

export type LinkRequest =
  | { provider: "google" | "apple" }
  | { provider: "email"; email: string; password: string };

export type LinkOutcome =
  | { status: "linked" }
  | { status: "merge-required"; credential: AuthCredential };

function googleProvider(): AuthProvider {
  const provider = new GoogleAuthProvider();
  // Forces the account chooser. Without it a browser with exactly one Google
  // session signs straight back into the account the user just signed out of,
  // which reads as the sign-out having failed.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function appleProvider(): AuthProvider {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
}

/**
 * The "this identity already has its own account" signal, which Firebase spells
 * differently per provider: an OAuth credential rejects a link with
 * `auth/credential-already-in-use`, an email/password one with
 * `auth/email-already-in-use`.
 *
 * Platform-side rather than in core, because the codes are the *SDK's*
 * vocabulary and the two SDKs are free to disagree about them. Core only ever
 * sees the `LinkOutcome` this produces.
 */
function isIdentityAlreadyInUse(error: unknown): boolean {
  const code = authErrorCode(error);
  return (
    code === "auth/credential-already-in-use" ||
    code === "auth/email-already-in-use" ||
    code === "auth/account-exists-with-different-credential"
  );
}

/**
 * Recovering the credential from the rejection is the whole reason the merge
 * can proceed without a second popup — and a second popup is not merely
 * unpleasant here, it is blocked: it would be issued after an `await`, outside
 * the task the user's click started.
 *
 * `credentialFromError` is an OAuth-only static and returns `null` for
 * anything else, which is why the email arm below rebuilds its credential from
 * the inputs it still holds rather than calling this.
 */
function oauthCredentialFromError(
  provider: "google" | "apple",
  error: unknown,
): AuthCredential | null {
  // The SDK types this as taking a `FirebaseError`; it reads `customData` off
  // whatever it is given and returns null when that is absent, so an unknown
  // rejection is answered with null rather than a throw.
  const fromError =
    provider === "google"
      ? GoogleAuthProvider.credentialFromError
      : OAuthProvider.credentialFromError;
  return fromError(error as Parameters<typeof fromError>[0]);
}

export async function linkProvider(request: LinkRequest): Promise<LinkOutcome> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No current user to link");

  if (request.provider === "email") {
    const credential = EmailAuthProvider.credential(
      request.email,
      request.password,
    );
    try {
      await linkWithCredential(user, credential);
      return { status: "linked" };
    } catch (error) {
      if (!isIdentityAlreadyInUse(error)) throw error;
      return { status: "merge-required", credential };
    }
  }

  const provider =
    request.provider === "google" ? googleProvider() : appleProvider();

  try {
    await linkWithPopup(user, provider);
    return { status: "linked" };
  } catch (error) {
    if (!isIdentityAlreadyInUse(error)) throw error;
    const credential = oauthCredentialFromError(request.provider, error);
    // A rejection that says "already in use" but carries no credential leaves
    // nothing to merge *with*. Rethrowing is the only honest answer: reporting
    // `merge-required` would send the caller into a flow that deletes the
    // anonymous account's documents on the way to a sign-in it cannot perform.
    if (!credential) throw error;
    return { status: "merge-required", credential };
  }
}
