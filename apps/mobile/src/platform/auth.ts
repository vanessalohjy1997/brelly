import type { AuthCredential } from "@react-native-firebase/auth";

import {
  getAppleCredential,
  getEmailCredential,
  getGoogleCredential,
} from "@/services/auth";
import { linkCurrentUser } from "@/services/firebase";
import { authErrorCode } from "@brelly/core";

/**
 * An identity provider's credential, opaque to core.
 *
 * A plain alias per app rather than a branded type. A brand would read as
 * safer and cost more than it is worth: every mobile call that hands this back
 * to `signInWithLinkedCredential` would need a cast, and the thing the brand
 * would be protecting against — passing one SDK's credential to the other — is
 * impossible, because only one SDK is ever bundled.
 */
export type PlatformCredential = AuthCredential;

/** What the user asked to link, before any provider sheet or popup has run. */
export type LinkRequest =
  | { provider: "google" | "apple" }
  | { provider: "email"; email: string; password: string };

export type LinkOutcome =
  | { status: "linked" }
  | { status: "merge-required"; credential: PlatformCredential };

/**
 * Acquiring a credential and linking it are **one call**, not two, and that is
 * the whole reason this seam is shaped the way it is.
 *
 * On native the two steps really are separable — a sheet returns an
 * `AuthCredential`, and `linkWithCredential` is a separate round trip. On the
 * web they are not: `signInWithPopup` *is* the sign-in, and there is no earlier
 * moment at which a credential exists. A `getCredential()` seam would therefore
 * have no web implementation at all.
 *
 * The credential still has to come back out, because the merge that follows a
 * `"merge-required"` needs to switch identity with the *same* credential after
 * it has deleted the anonymous user's documents. Re-acquiring it there is not
 * an option: on native it means a second provider sheet, and on web a second
 * popup issued after an `await` is outside the user-gesture task and is
 * blocked outright. So the seam carries the intent in and an opaque handle out.
 */
export async function linkProvider(request: LinkRequest): Promise<LinkOutcome> {
  const credential = await acquireCredential(request);
  try {
    await linkCurrentUser(credential);
    return { status: "linked" };
  } catch (error) {
    if (!isIdentityAlreadyInUse(error)) throw error;
    return { status: "merge-required", credential };
  }
}

function acquireCredential(request: LinkRequest): Promise<PlatformCredential> {
  switch (request.provider) {
    case "google":
      return getGoogleCredential();
    case "apple":
      return getAppleCredential();
    case "email":
      // Synchronous on native — an email credential is built from the inputs
      // rather than fetched — but the seam is uniformly async because the web
      // implementation of the other two arms cannot be anything else.
      return Promise.resolve(
        getEmailCredential(request.email, request.password),
      );
  }
}

/**
 * The "this identity already has its own account" signal, which Firebase
 * spells differently per provider: an OAuth credential rejects a link with
 * `auth/credential-already-in-use`, while an email/password one rejects it
 * with `auth/email-already-in-use`. Only matching the first is why the email
 * flow could never reach the merge — a second attempt with an address that had
 * already been linked surfaced as a flat "Couldn't back up your data".
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
