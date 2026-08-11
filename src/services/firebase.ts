import {
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
} from "@react-native-firebase/auth";
import { collection, doc, getFirestore } from "@react-native-firebase/firestore";

/**
 * The modular API's entry point everywhere else in the app reaches for the
 * current user or uid — `getAuth()` with no argument resolves the default
 * app, which is the only one this app configures.
 */
export function getFirebaseAuth() {
  return getAuth();
}

/** Same default-app resolution as `getFirebaseAuth`, for Firestore. */
export function getFirebaseFirestore() {
  return getFirestore();
}

/**
 * Signs in anonymously if no session survived from a previous launch.
 * Resolves from the Keychain-cached session on a returning launch, so this
 * never blocks on the network.
 */
export async function ensureAnonymousUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return;
  await firebaseSignInAnonymously(auth);
}

/**
 * A collision-proof id, generated client-side with no network round trip —
 * what lets `addSlot`/`addRoutine` mint an id and return synchronously before
 * any write happens. See FIREBASE_MIGRATION.md's "IDs" section.
 *
 * The collection name is a placeholder: Firestore's auto-id generation is a
 * local random string unrelated to where the doc ends up living.
 */
export function generateDocId(): string {
  return doc(collection(getFirestore(), "_autoIds")).id;
}
