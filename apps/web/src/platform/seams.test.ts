import * as appSettingsSeam from "@brelly/platform/appSettings";
import * as authSeam from "@brelly/platform/auth";
import * as dialogsSeam from "@brelly/platform/dialogs";
import * as firebaseSeam from "@brelly/platform/firebase";
import * as firestoreSeam from "@brelly/platform/firestore";
import * as hapticsSeam from "@brelly/platform/haptics";
import * as notificationsSeam from "@brelly/platform/notifications";
import * as storageSeam from "@brelly/platform/storage";

import * as firestoreSdk from "firebase/firestore";
import * as firebaseService from "@/services/firebase";

/**
 * The web half of the seam check `apps/mobile/src/platform/seams.test.ts`
 * performs, and the pair is the point: core names one specifier and two apps
 * answer it, so the thing worth asserting is that the two answers have the same
 * shape. A symbol added on one side and forgotten on the other fails here
 * rather than in a Next build three commits later.
 *
 * Resolution is the other half. `@brelly/platform/*` is declared in
 * `tsconfig.json` for `tsc` and in `jest.config.js` for Jest — two consumers,
 * no shared source — so a mapping that silently stops matching is a real
 * failure mode, and one nothing else in this suite would notice.
 */
describe("the @brelly/platform seams", () => {
  it.each([
    ["firestore", firestoreSeam],
    ["firebase", firebaseSeam],
    ["storage", storageSeam],
    ["dialogs", dialogsSeam],
    ["haptics", hapticsSeam],
    ["notifications", notificationsSeam],
    ["appSettings", appSettingsSeam],
    ["auth", authSeam],
  ])("resolves @brelly/platform/%s to something with bindings", (_name, seam) => {
    const bindings = Object.values(seam);
    expect(bindings.length).toBeGreaterThan(0);
    // `Object.values`, not `Object.keys`: a re-export is a getter, and only
    // reading it proves the module behind it actually loaded. Keys alone are
    // satisfied by a namespace whose every binding throws on access.
    for (const binding of bindings) expect(binding).toBeDefined();
  });

  it("carries the whole Firestore surface core is allowed to use", () => {
    // Character-for-character the list in the mobile suite. Widening it is a
    // decision — it commits the other app to providing the symbol too — so it
    // should take a failing test here to make it.
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

  it("hands back the SDK's own functions, not copies", () => {
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

  it("keeps storage on the localStorage-shaped surface", () => {
    storageSeam.platformStorage.setItem("seam-probe", "kept");
    expect(storageSeam.platformStorage.getItem("seam-probe")).toBe("kept");
    storageSeam.platformStorage.removeItem("seam-probe");
    expect(storageSeam.platformStorage.getItem("seam-probe")).toBeNull();
  });

  it("offers the same three questions the phone stops to ask", () => {
    expect(Object.keys(dialogsSeam).sort()).toEqual([
      "askEditScope",
      "confirmSignOut",
      "promptMergeChoice",
    ]);
  });

  it("names the link intent, and nothing about a credential's shape", () => {
    // `PlatformCredential` is a *type*, so it leaves no runtime trace here —
    // which is the design: core holds the credential as an opaque handle and
    // hands it straight back to `signInWithLinkedCredential`. What the seam
    // exports at runtime is the one function, matching the mobile file.
    expect(Object.keys(authSeam)).toEqual(["linkProvider"]);
  });

  it("keeps the haptics seam to the two the toast store fires", () => {
    // `hapticDelete`/`hapticToggle` are called from row actions in the UI
    // layer, which each app rebuilds, so they never cross the boundary.
    expect(Object.keys(hapticsSeam).sort()).toEqual([
      "hapticError",
      "hapticSuccess",
    ]);
  });
});
