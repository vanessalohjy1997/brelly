import { create } from "zustand";

import { askDialog } from "./dialogStore";

/**
 * Whether a form somewhere is holding unsaved edits.
 *
 * A store rather than a hook's return value, and that is the point rather than
 * a convenience: on the phone a half-filled form is a *modal*, so its only
 * exits are its own Cancel button and a swipe it can switch off. A web page has
 * a third exit the modal never had — the sidebar, which is rendered by a
 * component that knows nothing about the form. This is how it finds out.
 */
type UnsavedChangesState = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
};

export const useUnsavedChangesStore = create<UnsavedChangesState>()((set) => ({
  dirty: false,
  setDirty: (dirty) => set({ dirty }),
}));

/**
 * Asks before throwing away unsaved edits, and answers `true` straight through
 * when there are none.
 *
 * A confirmation on an untouched form is pure friction, and one that always
 * appears is one people learn to dismiss without reading — which is why this
 * checks first rather than leaving it to each caller.
 */
export async function confirmDiscard(): Promise<boolean> {
  if (!useUnsavedChangesStore.getState().dirty) return true;

  const answer = await askDialog({
    title: "Discard changes?",
    message: "This plan hasn't been saved.",
    dismissKey: "keep",
    actions: [
      { key: "discard", label: "Discard", tone: "destructive" },
      { key: "keep", label: "Keep editing", tone: "cancel" },
    ],
  });

  return answer === "discard";
}

/**
 * `Link`'s `onNavigate` handler, for every in-app link that could leave a dirty
 * form behind.
 *
 * `preventDefault` is synchronous and the question is not, so a blocked
 * navigation has to be re-issued by hand once the answer comes back — there is
 * no way to "resume" a prevented one. `navigate` is that re-issue.
 */
export function guardNavigation(
  event: { preventDefault: () => void },
  navigate: () => void,
): void {
  if (!useUnsavedChangesStore.getState().dirty) return;

  event.preventDefault();
  void confirmDiscard().then((discard) => {
    if (!discard) return;
    // Cleared before navigating, or the *next* page's links would inherit a
    // dirty flag belonging to a form that is gone.
    useUnsavedChangesStore.getState().setDirty(false);
    navigate();
  });
}
