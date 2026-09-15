/**
 * The wrappers around auth and Firestore that core calls but neither SDK ships.
 *
 * This is the seam a "just re-export the same names" reading of the boundary
 * misses. `getFirebaseAuth`, `generateDocId`, `ensureAnonymousUser` and the
 * rest exist in `@react-native-firebase/*` no more than they do in `firebase/*`
 * — they are this app's own functions, and six core-bound modules import them.
 * Without this file, core imports an app file and the boundary is a fiction.
 *
 * `subscribeToAuthUser` is not re-exported: its only caller is `useAuthUser`,
 * which is a mobile hook and rebuilt for web, so core never reaches for it.
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
