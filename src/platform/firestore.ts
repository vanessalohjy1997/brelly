/**
 * The Firestore modular API, under one specifier so core does not name a SDK.
 *
 * Deliberately a re-export and nothing more: the eleven symbols below are the
 * entire Firestore surface of non-test `src/`, and every one exists
 * name-for-name in both `@react-native-firebase/firestore` and the web
 * `firebase/firestore`. Adding a symbol here is a decision — it commits the web
 * app to providing it — so keep the list closed rather than re-exporting `*`.
 *
 * Name-for-name is not behaviour-for-behaviour. The four places the two
 * packages differ (batch commit resolution, cache-vs-server snapshots, default
 * cache durability, and the absence of `services/firebase.ts`'s wrappers) are
 * handled where they bite, not here; the last of them is why
 * `@brelly/platform/firebase` exists alongside this file.
 *
 * `jest.setup.js` mocks `@react-native-firebase/firestore` by specifier, and a
 * re-export pulls the same `jest.fn` instances out of the module registry — so
 * identity assertions and `jest.requireMock` keep working through this file.
 */
export {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "@react-native-firebase/firestore";
