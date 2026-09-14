/**
 * The Firestore modular API, faked. Mirrors `src/platform/firestore.ts`'s
 * twelve-symbol surface exactly — a name here that core imports and the real
 * seam lacks would let a test pass against something no platform provides.
 */
import { createFirestoreMock } from "../fakeFirestore";

const mock = createFirestoreMock();

export const arrayRemove = mock.arrayRemove;
export const arrayUnion = mock.arrayUnion;
export const collection = mock.collection;
export const deleteDoc = mock.deleteDoc;
export const deleteField = mock.deleteField;
export const doc = mock.doc;
export const getDocsFromServer = mock.getDocsFromServer;
export const getFirestore = mock.getFirestore;
export const onSnapshot = mock.onSnapshot;
export const setDoc = mock.setDoc;
export const writeBatch = mock.writeBatch;
export type Unsubscribe = () => void;
