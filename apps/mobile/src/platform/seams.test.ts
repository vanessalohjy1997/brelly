import * as firestoreSeam from "@brelly/platform/firestore";
import * as firebaseSeam from "@brelly/platform/firebase";
import * as storageSeam from "@brelly/platform/storage";
import * as dialogsSeam from "@brelly/platform/dialogs";
import * as hapticsSeam from "@brelly/platform/haptics";
import * as notificationsSeam from "@brelly/platform/notifications";
import * as appSettingsSeam from "@brelly/platform/appSettings";

import * as firestoreSdk from "@react-native-firebase/firestore";
import * as firebaseService from "@/services/firebase";

/**
 * The seams are re-exports, so there is nothing in them to test in the usual
 * sense — but there are two things that can silently stop being true, and both
 * would surface far from here.
 *
 * The first is resolution: the `@brelly/platform/*` specifier is declared in
 * `tsconfig.json` alone, and three separate consumers have to honour it. `tsc`
 * and Metro are their own proof; Jest reaches it through `jest-expo`'s
 * `withTypescriptMapping`, which is the one of the three nothing else in this
 * suite exercises.
 *
 * The second is mock transitivity. `jest.setup.js` replaces
 * `@react-native-firebase/firestore` by specifier, so a re-export has to hand
 * back the very same `jest.fn` instances rather than fresh ones — otherwise
 * every `expect(setDoc).toHaveBeenCalled` in the sync tests starts asserting
 * against a function nobody called, once those tests reach Firestore through
 * the seam instead of the SDK.
 */
describe("the @brelly/platform seams", () => {
  it("resolves every specifier under the Jest tsconfig path mapping", () => {
    expect(Object.keys(firestoreSeam).length).toBeGreaterThan(0);
    expect(Object.keys(firebaseSeam).length).toBeGreaterThan(0);
    expect(Object.keys(storageSeam).length).toBeGreaterThan(0);
    expect(Object.keys(dialogsSeam).length).toBeGreaterThan(0);
    expect(Object.keys(hapticsSeam).length).toBeGreaterThan(0);
    expect(Object.keys(notificationsSeam).length).toBeGreaterThan(0);
    expect(Object.keys(appSettingsSeam).length).toBeGreaterThan(0);
  });

  it("carries the whole Firestore surface core is allowed to use", () => {
    expect(Object.keys(firestoreSeam).sort()).toEqual([
      "arrayRemove",
      "arrayUnion",
      "collection",
      "deleteDoc",
      "deleteField",
      "doc",
      "getDocsFromServer",
      "getFirestore",
      "onSnapshot",
      "setDoc",
      "writeBatch",
    ]);
  });

  it("hands back the same mocked Firestore functions, not copies", () => {
    expect(firestoreSeam.setDoc).toBe(firestoreSdk.setDoc);
    expect(firestoreSeam.writeBatch).toBe(firestoreSdk.writeBatch);
    expect(firestoreSeam.onSnapshot).toBe(firestoreSdk.onSnapshot);
  });

  it("carries the wrappers that exist in neither Firestore SDK", () => {
    expect(Object.keys(firebaseSeam).sort()).toEqual([
      "ensureAnonymousUser",
      "generateDocId",
      "getFirebaseAuth",
      "getFirebaseFirestore",
      "linkCurrentUser",
      "signInWithLinkedCredential",
      "signOutCurrentUser",
    ]);
    expect(firebaseSeam.generateDocId).toBe(firebaseService.generateDocId);
  });

  it("keeps storage on the localStorage-shaped surface web already has", () => {
    storageSeam.platformStorage.setItem("seam-probe", "kept");
    expect(storageSeam.platformStorage.getItem("seam-probe")).toBe("kept");
    storageSeam.platformStorage.removeItem("seam-probe");
    expect(storageSeam.platformStorage.getItem("seam-probe")).toBeNull();
  });
});
