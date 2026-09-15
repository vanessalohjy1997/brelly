/**
 * The Firestore modular API, under one specifier so core does not name a SDK.
 *
 * Deliberately a re-export and nothing more, and the list is closed rather than
 * `export *`: these eleven symbols are the entire Firestore surface core is
 * allowed to use, and adding one here commits the *other* app to providing it
 * too. The mobile file of this name exports exactly the same names from
 * `@react-native-firebase/firestore`.
 *
 * Name-for-name is not behaviour-for-behaviour, and the differences are handled
 * where they bite rather than here:
 *
 * - **cache durability** — `services/firebase.ts`, which must call
 *   `initializeFirestore` before the first `getFirestore()`. That is why
 *   `getFirestore` is re-exported below without anything in this app calling it;
 * - **`writeBatch.commit()` and `deleteDoc` resolve on server ack**, not on
 *   local-cache apply, so they hang offline where the RN SDK returns at once;
 * - **first snapshots can be `fromCache`**, so a reader treating one as
 *   authoritative sees an empty account that is merely unhydrated;
 * - the wrappers in `services/firebase.ts`, which exist in neither package —
 *   that is what `@brelly/platform/firebase` is for.
 */
export {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
