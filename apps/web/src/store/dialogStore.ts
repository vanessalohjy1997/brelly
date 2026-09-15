import { create } from "zustand";

/**
 * The three questions the app has to stop and ask, on the web.
 *
 * `Alert.alert` has no browser equivalent worth using. `window.confirm` is
 * synchronous, unstyleable, and offers two buttons where two of these three
 * need three — `promptMergeChoice` alone rules it out. So a request goes into
 * this store, `DialogHost` renders it, and the promise settles on the button
 * pressed.
 *
 * Deliberately shaped like `toastStore`: one live item, an imperative entry
 * point, and no React in the calling code. That is what lets the callers keep
 * the `Promise`-returning signatures the mobile utilities already have, which
 * is the actual seam — the platform difference is the renderer, not the API.
 */
export type DialogTone = "default" | "cancel" | "destructive";

export type DialogAction = {
  /** Returned by `askDialog` when this button is pressed. */
  key: string;
  label: string;
  tone?: DialogTone;
};

export type DialogRequest = {
  /** Monotonic, so `DialogHost` can key on it and re-open for a repeat ask. */
  id: number;
  title: string;
  message: string;
  actions: DialogAction[];
  /**
   * What a dismissal resolves to — Escape, the backdrop, the close button.
   * Every caller depends on this being a "leave everything alone" value: an
   * unanswered question must not commit.
   */
  dismissKey: string;
};

type DialogState = {
  dialog: DialogRequest | null;
  /** Settles the open dialog with `key` and clears it. */
  answer: (key: string) => void;
};

let nextId = 1;
let pendingResolve: ((key: string) => void) | null = null;

export const useDialogStore = create<DialogState>()((set, get) => ({
  dialog: null,
  answer: (key) => {
    // Guard against a double answer — a button press that also closes the
    // native `<dialog>` would otherwise settle once and then dismiss into a
    // second, contradictory answer.
    if (!get().dialog) return;
    const resolve = pendingResolve;
    pendingResolve = null;
    set({ dialog: null });
    resolve?.(key);
  },
}));

/**
 * Asks, and resolves to the `key` of the button pressed.
 *
 * A second ask while one is open settles the first as dismissed rather than
 * stacking. Two modal questions at once is not a state any caller here can
 * produce on purpose, and silently dropping the earlier promise would hang
 * whatever was waiting on it.
 */
export function askDialog(
  request: Omit<DialogRequest, "id">,
): Promise<string> {
  const { dialog, answer } = useDialogStore.getState();
  if (dialog) answer(dialog.dismissKey);

  return new Promise<string>((resolve) => {
    pendingResolve = resolve;
    useDialogStore.setState({ dialog: { ...request, id: nextId++ } });
  });
}
