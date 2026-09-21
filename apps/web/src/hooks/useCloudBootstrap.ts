"use client";

import { useEffect } from "react";

import {
  attachCloudListeners,
  describeCloudSyncError,
  detachCloudListeners,
  resumePendingMergeIfNeeded,
  useCloudReady,
  useCloudSyncStore,
} from "@brelly/core";
import { ensureAnonymousUser, getFirebaseAuth } from "@/services/firebase";
import { useLocalCacheStore } from "@/store/localCacheStore";

/**
 * How long to wait for a first snapshot before saying something is wrong.
 *
 * This guard has no mobile counterpart and is not caution for its own sake.
 * `@react-native-firebase` persists its cache to disk, so an offline phone
 * still gets a first `onSnapshot` delivery — from the cache, with
 * `fromCache: true` — and `setSlotsReady` fires. The web SDK on a **memory**
 * cache has nothing to deliver from, so an offline first visit attaches three
 * listeners that never call back: no error, no rejection, nothing for
 * `runBootstrap`'s `catch` to see, and a skeleton that spins forever.
 *
 * Eight seconds is long enough that a slow connection resolves normally and
 * short enough that a dead one is not mistaken for a slow one.
 */
const FIRST_SNAPSHOT_TIMEOUT_MS = 8000;

/**
 * `isCancelled` lets the mount-effect call abort after its own unmount —
 * React's development double-invoke (and Fast Refresh) can otherwise leave two
 * overlapping bootstrap attempts in flight. `retryCloudBootstrap`'s one-shot
 * call has nothing to abort into, so it does not pass one.
 */
async function runBootstrap(
  isCancelled: () => boolean = () => false,
): Promise<void> {
  try {
    await ensureAnonymousUser();
    if (isCancelled()) return;
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid) return;

    attachCloudListeners(uid);

    // A no-op on every ordinary load. It does something only when a previous
    // session died somewhere inside `mergeIntoExistingAccount`, which is not
    // atomic and cannot be: it spans two auth identities. A browser tab gets
    // closed mid-flow far more casually than an app gets killed, which is why
    // this matters more here than on the phone.
    resumePendingMergeIfNeeded().catch(() => {
      // Left for the next load to retry. The record is still in storage.
    });

    useCloudSyncStore.getState().setBootstrapError(null);
  } catch (error) {
    // A failure here leaves the readiness flags false rather than crashing the
    // boot path — but it is surfaced through `bootstrapError` so a skeleton can
    // show it instead of spinning forever with no explanation.
    console.error("[useCloudBootstrap] bootstrap failed", error);
    if (!isCancelled()) {
      useCloudSyncStore
        .getState()
        .setBootstrapError(describeBootstrapFailure(error));
    }
  }
}

/**
 * What the skeleton says when sign-in itself threw.
 *
 * "Check your connection" used to be the answer to every failure here, and it
 * sent people to fix the wrong thing: a disabled provider, an unauthorised
 * domain or a bad key all fail the same `await` with the network up. Only a
 * network error — the SDK's own code, or the browser saying it is offline —
 * is about the connection.
 */
export function describeBootstrapFailure(
  error: unknown,
  online: boolean = typeof navigator === "undefined" ? true : navigator.onLine,
): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (!online || code === "auth/network-request-failed") {
    return describeCloudSyncError();
  }
  return "We couldn't sign you in to load your plans. Try again, and if it keeps happening, reload the page.";
}

/** Re-runs sign-in and listener attachment — the action behind a skeleton's
 * "Try again" once `useCloudBootstrapError()` is set. */
export function retryCloudBootstrap(): void {
  useCloudSyncStore.getState().setBootstrapError(null);
  void runBootstrap();
}

/** What the skeleton says when the listeners simply never answered. */
export function describeSilentBootstrap(cacheIsDegraded: boolean): string {
  return cacheIsDegraded
    ? "We couldn't reach your plans, and this browser isn't storing a copy — try again once you're back online."
    : describeCloudSyncError();
}

/**
 * Mounted once, at the root. Signs in anonymously if needed, attaches the live
 * listeners for every store on Firestore, and reports readiness so a screen can
 * show a skeleton instead of a flash of empty values.
 *
 * Two differences from the mobile hook, both because of what each platform is:
 *
 * - there is no local→cloud migration step. That exists to lift a phone's
 *   pre-Firestore MMKV blobs into the cloud once; a browser has never had any;
 * - the timeout above, which turns "no snapshot ever arrived" from a silent
 *   hang into something the skeleton can say.
 */
export function useCloudBootstrap(): boolean {
  const ready = useCloudReady();

  useEffect(() => {
    let cancelled = false;
    void runBootstrap(() => cancelled);

    return () => {
      cancelled = true;
      detachCloudListeners();
    };
  }, []);

  useEffect(() => {
    if (ready) return;

    const timer = setTimeout(() => {
      const state = useCloudSyncStore.getState();
      // Only if nothing has landed *and* nothing else has already explained
      // why — a rules rejection has a better message than this one.
      if (state.settingsReady || state.routinesReady || state.slotsReady) return;
      if (state.bootstrapError) return;
      state.setBootstrapError(
        describeSilentBootstrap(useLocalCacheStore.getState().mode === "memory"),
      );
    }, FIRST_SNAPSHOT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [ready]);

  return ready;
}
