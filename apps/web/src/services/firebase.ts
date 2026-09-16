import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithCredential,
  signOut,
  type Auth,
  type AuthCredential,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

import { useLocalCacheStore } from "@/store/localCacheStore";

/**
 * The web fork of `services/firebase.ts`. Function-for-function identical to
 * the mobile one — `@brelly/platform/firebase` re-exports the same seven names
 * from whichever of the two the bundler picked — with one addition that has no
 * mobile counterpart: the cache configuration below.
 *
 * `authDomain` is the load-bearing value here, not `projectId`. `signInWithPopup`
 * bounces through `https://<authDomain>/__/auth/handler`, and when that is a
 * different origin from the page the hop is cross-site — which Safari's storage
 * partitioning breaks, with `signInWithRedirect` failing identically rather than
 * serving as a fallback. Firebase Hosting serves `/__/**` from the same
 * `*.web.app` site the app is deployed to, so setting this to that site (and
 * deploying behind the Hosting rewrite, not straight to the App Hosting domain)
 * is what makes the handler same-origin. See WEB.md, "Hosting and popup auth".
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * The three values without which nothing works. `storageBucket` and
 * `messagingSenderId` are left out deliberately — this app uploads nothing and
 * sends no messages, so demanding them would block a working dev setup on two
 * values it never reads.
 */
const REQUIRED_CONFIG = ["apiKey", "authDomain", "projectId"] as const;

/**
 * Says which variable is missing, rather than letting Firebase say the key is
 * invalid.
 *
 * `NEXT_PUBLIC_*` is a literal text substitution: an unset one is not a
 * variable that reads as empty, it is the string `undefined` handed to the SDK.
 * What comes back is `auth/invalid-api-key` thrown from `getAuth()`, four
 * frames deep in bootstrap, pointing at Firebase — which is the same shape of
 * failure `configureCore()` exists to prevent, and the same fix: fail at the
 * seam, naming the thing that is actually absent.
 */
function firebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();

  const missing = REQUIRED_CONFIG.filter((key) => !firebaseConfig[key]);
  if (missing.length > 0) {
    throw new Error(
      `Firebase is not configured: ${missing
        .map((key) => `NEXT_PUBLIC_FIREBASE_${camelToEnv(key)}`)
        .join(", ")} ${missing.length === 1 ? "is" : "are"} unset. ` +
        "Copy apps/web/.env.example to apps/web/.env.local and fill it in from " +
        "the Firebase console's Web app config (Project settings → Your apps).",
    );
  }

  return initializeApp(firebaseConfig);
}

/** `authDomain` → `AUTH_DOMAIN`, so the message names the variable to set. */
function camelToEnv(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

let firestore: Firestore | null = null;

/**
 * Same default-app resolution as the mobile wrapper, plus the one difference
 * between the two SDKs that cannot be papered over by a re-export.
 *
 * `@react-native-firebase` persists its cache to disk unconditionally. The web
 * SDK's default is **memory-only**, and the code both apps share relies on
 * Firestore applying writes locally whatever the network is doing — so on the
 * default settings an edit made offline is silently gone on reload. Worse than
 * the lost edit: with no cache and no network, `attachCloudListeners` never
 * receives a first snapshot, the readiness flags never flip, and the skeleton
 * spins in a place `runBootstrap`'s `catch` cannot see.
 *
 * So the persistent cache is asked for, inside a `try` — it is refused, not
 * degraded, in Safari's private mode and under Firefox's ETP, and asking for it
 * at module scope would white-screen the app there. The fallback records what
 * happened so the UI can say that changes will not survive a reload.
 *
 * `initializeFirestore` must run before the first `getFirestore()`, which is
 * why this is the only place in the web app that constructs a Firestore
 * instance and why `@brelly/platform/firestore` re-exports `getFirestore` for
 * core's sake without anything here calling it.
 */
export function getFirebaseFirestore(): Firestore {
  if (firestore) return firestore;

  // The persistent cache is IndexedDB-backed and browser-only. During SSR
  // there is no window to persist into, and asking would throw on every
  // request — so the server takes the memory cache deliberately rather than
  // by fallback, and does not report itself as degraded.
  if (typeof window === "undefined") {
    firestore = initializeFirestore(firebaseApp(), {
      localCache: memoryLocalCache(),
    });
    return firestore;
  }

  try {
    firestore = initializeFirestore(firebaseApp(), {
      // Multi-tab rather than the single-tab default: two Brelly tabs is an
      // ordinary thing to have open, and the single-tab manager fails the
      // second one with `failed-precondition` over a lease it cannot get.
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (error) {
    firestore = initializeFirestore(firebaseApp(), {
      localCache: memoryLocalCache(),
    });
    useLocalCacheStore
      .getState()
      .setMode("memory", error instanceof Error ? error.message : String(error));
  }

  return firestore;
}

/**
 * The modular API's entry point everywhere else in the app reaches for the
 * current user or uid — `getAuth()` resolves the default app, which is the only
 * one this app configures.
 */
export function getFirebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

/**
 * Signs in anonymously if no session survived from a previous visit. Firebase
 * Auth persists to `localStorage` by default on the web, so this resolves from
 * the stored session on a return visit rather than blocking on the network.
 */
export async function ensureAnonymousUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return;
  await firebaseSignInAnonymously(auth);
}

/**
 * A collision-proof id, generated client-side with no network round trip —
 * what lets `addSlot`/`addRoutine` mint an id and return synchronously before
 * any write happens.
 *
 * The collection name is a placeholder: Firestore's auto-id generation is a
 * local random string unrelated to where the doc ends up living.
 */
export function generateDocId(): string {
  return doc(collection(getFirebaseFirestore(), "_autoIds")).id;
}

/**
 * Links a real identity onto the current (anonymous) user, preserving its uid.
 * Throws `auth/credential-already-in-use` when that identity already has its
 * own account; the caller reads that as the signal to start a merge, not as a
 * failure.
 */
export function linkCurrentUser(credential: AuthCredential) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No current user to link");
  return linkWithCredential(user, credential);
}

/**
 * Switches the current session to the account a credential already belongs to —
 * the second half of the merge, after the anonymous user's own documents have
 * been deleted while still authenticated as it.
 */
export function signInWithLinkedCredential(credential: AuthCredential) {
  return signInWithCredential(getFirebaseAuth(), credential);
}

/**
 * Ends the current session. Leaves `currentUser` null, which no other part of
 * the app is built to sit in — `signOutOfAccount` immediately signs a new
 * anonymous user back in, and nothing else should call this directly.
 */
export function signOutCurrentUser() {
  return signOut(getFirebaseAuth());
}

/** Reactive current-user stream, for `useAuthUser`. */
export function subscribeToAuthUser(
  onChange: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), onChange);
}
