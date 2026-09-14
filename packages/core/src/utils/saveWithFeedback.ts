import { showToast, type ToastAction } from "@/store/toastStore";

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
 * The `catch` is a backstop, not a hot path: the stores no longer use
 * zustand's `persist`, so there is no synchronous storage write left to throw
 * out of the action. What it still buys is that an action which does throw
 * reports itself as a toast instead of taking the screen down.
 *
 * The toast is the only feedback raised here. The haptic that used to go with
 * it now comes from `toastHaptics.ts`, off the toast store — see that file.
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
    showToast(messages.success, "success", messages.successAction);
    return { ok: true, value };
  } catch (error) {
    showToast(messages.failure, "error");
    return { ok: false, error };
  }
}

/**
 * For a background Firestore write that fails after the triggering store
 * action already returned — a fire-and-forget `.catch()`, not this file's
 * synchronous `try`/`catch`. By the time this fires the local change is
 * already on screen, so the message says the data is still safe rather than
 * that it wasn't saved. See FIREBASE_MIGRATION.md's `saveWithFeedback.ts`
 * section.
 */
export function notifyCloudSyncFailure(): void {
  showToast("Couldn't sync to the cloud — you're still working locally", "error");
}
