import type { AuthCredential } from "firebase/auth";

/**
 * An identity provider's credential, opaque to core.
 *
 * A plain alias per app rather than a branded type, for the reason the mobile
 * file of this name gives: a brand would force a cast at every
 * `signInWithLinkedCredential` boundary, and the mistake it would guard against
 * — handing one SDK's credential to the other — cannot happen, because only one
 * SDK is ever bundled.
 */
export type PlatformCredential = AuthCredential;

/**
 * Acquiring a credential and linking it are **one call** on the web, which is
 * why the seam takes an intent rather than exposing a `getCredential()` with no
 * web implementation — `signInWithPopup` *is* the sign-in, and there is no
 * earlier moment at which a credential exists.
 *
 * The credential still comes back out, because the merge that follows a
 * `"merge-required"` has to switch identity with the *same* one after deleting
 * the anonymous user's documents. A second popup there would be issued after an
 * `await`, outside the user-gesture task, and blocked outright.
 */
export {
  linkProvider,
  type LinkOutcome,
  type LinkRequest,
} from "@/services/auth";
