import { create } from "zustand";

export type ToastVariant = "success" | "error";

/**
 * One button on the toast — in practice, "Undo".
 *
 * This is what makes a confirmation reversible rather than merely informative,
 * and it is why deletes need no confirmation dialog: an alert asks you to be
 * sure *before* you can see what happens, while an undo lets you be wrong for
 * five seconds. Pressing it dismisses the toast, so a handler never has to.
 */
export type ToastAction = {
  /** A verb — "Undo", not "OK". */
  label: string;
  onPress: () => void;
};

export type Toast = {
  /**
   * Monotonic. A dismiss timer carries the id it was started for, so a timer
   * left over from a replaced toast can't clear the one now on screen.
   */
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
};

type ToastState = {
  toast: Toast | null;

  /**
   * The ids of the mounted *modal* `ToastHost`s, innermost last. The root host
   * renders only while this is empty; otherwise the last entry wins.
   *
   * This exists because of how modals are presented. `plan/new` and
   * `plan/[id]` are `presentation: "modal"`, which on iOS is a real view
   * controller presented over the window: a host sitting at the root is
   * *behind* it, so a toast raised there would never be seen. Each modal
   * therefore mounts its own host and takes over while it is open, handing
   * back on dismiss. Because the toast itself lives here and not in the host,
   * one raised just before `router.back()` survives the modal that raised it
   * and finishes its life on the screen underneath.
   *
   * The root host is deliberately *not* in this list. Ranking every host by
   * mount order would put it last on a cold start straight into a modal —
   * both mount in the same commit, and the modal's effect runs first.
   */
  modalHosts: string[];

  show: (message: string, variant: ToastVariant, action?: ToastAction) => void;
  dismiss: (id?: number) => void;
  registerModalHost: (id: string) => void;
  unregisterModalHost: (id: string) => void;
};

let nextToastId = 1;

/**
 * Not persisted, and deliberately not a React context: deletes and form
 * submits raise toasts from plain callbacks — and, in the delete case, from a
 * component that is about to unmount.
 */
export const useToastStore = create<ToastState>()((set) => ({
  toast: null,
  modalHosts: [],

  show: (message, variant, action) =>
    set({ toast: { id: nextToastId++, message, variant, action } }),

  dismiss: (id) =>
    set((state) =>
      id === undefined || state.toast?.id === id ? { toast: null } : state,
    ),

  registerModalHost: (id) =>
    set((state) => ({ modalHosts: [...state.modalHosts, id] })),

  unregisterModalHost: (id) =>
    set((state) => ({
      modalHosts: state.modalHosts.filter((host) => host !== id),
    })),
}));

/** Raises a toast from anywhere, including outside a component. */
export function showToast(
  message: string,
  variant: ToastVariant = "success",
  action?: ToastAction,
) {
  useToastStore.getState().show(message, variant, action);
}

/** Clears `id` if it's still the toast on screen; clears whatever is if omitted. */
export function dismissToast(id?: number) {
  useToastStore.getState().dismiss(id);
}
