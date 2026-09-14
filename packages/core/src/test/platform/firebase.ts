/**
 * The wrappers neither Firestore SDK ships, over the in-memory fakes.
 *
 * These are the functions that make `@brelly/platform/firebase` a seam of its
 * own rather than a second re-export — `getFirebaseAuth` and friends belong to
 * the app, not to a package, so a fake of them is the only way core's suite
 * can exercise the sync layer at all.
 */
import { fakeAuth } from "../fakeAuth";
import { fakeFirestoreDb } from "../fakeFirestore";

export function getFirebaseAuth() {
  return fakeAuth;
}

export function getFirebaseFirestore() {
  return fakeFirestoreDb;
}

export async function ensureAnonymousUser(): Promise<void> {
  if (fakeAuth.currentUser) return;
  await fakeAuth.signInAnonymously();
}

export function generateDocId(): string {
  return fakeFirestoreDb.generateId();
}

export function linkCurrentUser(credential: unknown) {
  if (!fakeAuth.currentUser) throw new Error("No current user to link");
  return fakeAuth.linkWithCredential(credential as never);
}

export function signInWithLinkedCredential(credential: unknown) {
  return fakeAuth.signInWithCredential(credential as never);
}

export function signOutCurrentUser() {
  return fakeAuth.signOut();
}
