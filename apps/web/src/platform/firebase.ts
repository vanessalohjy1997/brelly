/**
 * The wrappers around auth and Firestore that core calls but neither SDK ships.
 *
 * This is the seam a "just re-export the same names" reading of the boundary
 * misses. `getFirebaseAuth`, `generateDocId`, `ensureAnonymousUser` and the
 * rest exist in `firebase/*` no more than they do in `@react-native-firebase/*`
 * — they are each app's own functions, and six core-bound modules import them.
 *
 * `subscribeToAuthUser` is not re-exported: its only caller is `useAuthUser`,
 * which is a UI hook each app owns, so core never reaches for it.
 */
export {
  ensureAnonymousUser,
  generateDocId,
  getFirebaseAuth,
  getFirebaseFirestore,
  linkCurrentUser,
  signInWithLinkedCredential,
  signOutCurrentUser,
} from "@/services/firebase";
