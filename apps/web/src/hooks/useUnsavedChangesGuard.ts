"use client";

import { useEffect } from "react";

import {
  confirmDiscard,
  useUnsavedChangesStore,
} from "@/store/unsavedChangesStore";

/** Marks a history entry as the guard's own, so a pop can be told apart. */
const SENTINEL = { brellyUnsavedGuard: true } as const;

/**
 * Stops a half-filled form being thrown away by a stray click, a Back press or
 * a closed tab.
 *
 * This is a rewrite rather than a port, and the phone's version is not a useful
 * guide: it sets `gestureEnabled: false` on a modal, which has no web
 * equivalent, and reads `useNavigation`, which `next/navigation` does not have.
 * The three exits a page has each need their own mechanism, and it is worth
 * being precise about what each one can and cannot do.
 *
 * 1. **In-app links** — the Cancel control, the sidebar, the bottom bar. These
 *    go through `guardNavigation` on `Link`'s `onNavigate`, which is the only
 *    one of the three that can ask *before* anything happens.
 * 2. **Browser Back** — `popstate` is not cancelable. The only way to stay put
 *    is to have pushed a spare history entry while the form was dirty, so the
 *    first Back press consumes *that* and lands on the same URL; the question
 *    is then asked, and a discard re-issues the Back for real.
 * 3. **Tab close and reload** — `beforeunload`, which cannot be styled, cannot
 *    carry a custom message in any current browser, and fires for nothing else.
 *
 * What the phone's baseline actually was is worth recording, because it is
 * weaker than it looks: `gestureEnabled` blocks the iOS swipe only. Android's
 * hardware Back already discarded a dirty form, so "the button is the only
 * exit" was an iOS-only claim. The Back guard here is therefore new behaviour
 * on two of the three platforms rather than a port of one.
 *
 * **The known cost**: a spare history entry is left behind when the form is
 * left by saving rather than by discarding, so Back needs one extra press
 * afterwards. Unwinding it on unmount is not safe — the unmount is itself
 * caused by a navigation, and a `history.back()` in that teardown races it.
 */
export function useUnsavedChangesGuard(dirty: boolean): () => Promise<boolean> {
  const setDirty = useUnsavedChangesStore((state) => state.setDirty);

  useEffect(() => {
    setDirty(dirty);
    // Cleared on unmount so the next page's links do not inherit a dirty flag
    // belonging to a form that is gone.
    return () => setDirty(false);
  }, [dirty, setDirty]);

  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => {
      // The modern spelling. `returnValue` is deprecated and the string is
      // ignored by every browser — what is shown is the browser's own wording.
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    window.history.pushState(SENTINEL, "");

    const onPop = () => {
      void confirmDiscard().then((discard) => {
        if (discard) {
          // The pop that woke this has already landed on the entry *behind* the
          // sentinel — the same URL, so nothing moved — and this second one is
          // the navigation the user asked for.
          useUnsavedChangesStore.getState().setDirty(false);
          window.history.back();
          return;
        }
        // Staying: put the buffer back, or the next Back press leaves without
        // asking.
        window.history.pushState(SENTINEL, "");
      });
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);

  return confirmDiscard;
}
