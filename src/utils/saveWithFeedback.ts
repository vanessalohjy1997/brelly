import { showToast, type ToastAction } from "@/store/toastStore";
import { hapticError, hapticSuccess } from "@/utils/haptics";

export type SaveResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

export type SaveMessages = {
  /** What was saved, in the user's words — "Rain alerts off", not "Saved". */
  success: string;
  /** What didn't happen, and that it can be retried. */
  failure: string;
  /**
   * A button on the success toast — "Undo" on a delete.
   *
   * Success only, and deliberately so: an undo offered after a save that threw
   * would invite the user to reverse something that never happened. The
   * failure toast's job is to say the change isn't there, and its remedy is to
   * try again, not to take it back.
   */
  successAction?: ToastAction;
};

/**
 * Runs a store mutation and tells the user whether it stuck.
 *
 * The two outcomes are real rather than decorative. Both stores are wrapped in
 * zustand's `persist`, which calls `mmkvStorage.setItem` *synchronously* from
 * inside `set(...)` and does not catch — so a storage write that fails throws
 * out of the action itself and lands in this `try`. On the success path the
 * change is already on disk by the time the toast is raised, and without this
 * wrapper the same failure would take the screen down instead.
 *
 * Returns the action's own return value on success, so callers can go on to
 * use what they just created (`addSlot` returns the new slot) and can skip
 * navigating away when the save didn't happen.
 */
export function saveWithFeedback<T>(
  action: () => T,
  messages: SaveMessages,
): SaveResult<T> {
  try {
    const value = action();
    hapticSuccess();
    showToast(messages.success, "success", messages.successAction);
    return { ok: true, value };
  } catch (error) {
    hapticError();
    showToast(messages.failure, "error");
    return { ok: false, error };
  }
}
