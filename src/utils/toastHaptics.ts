import { useToastStore } from "@brelly/core";
import { hapticError, hapticSuccess } from "@/utils/haptics";

/**
 * Makes every toast buzz, matching the haptic to the variant.
 *
 * The success/error haptics used to fire from inside `saveWithFeedback`, which
 * put `expo-haptics` in the import graph of the whole sync layer —
 * `notifyCloudSyncFailure` lives in that file and all three sync services call
 * it. The toast store was already the seam: a toast is exactly the moment the
 * user should feel something, so subscribing here keeps the native module at
 * the app entry and leaves the save helper platform-clean.
 *
 * It also makes the feedback consistent. Toasts raised outside
 * `saveWithFeedback` — a failed calendar write, a weather refresh that
 * couldn't reach the service — were silent before; now they are not.
 *
 * Returns zustand's unsubscribe. The app subscribes once, for its lifetime;
 * the return value is there so a test can undo it.
 */
export function subscribeToastHaptics(): () => void {
  return useToastStore.subscribe((state, previous) => {
    const toast = state.toast;
    // Only a *new* toast buzzes. `dismiss` and the modal-host registrations
    // fire this subscriber too, and a toast replaced by another of the same
    // variant still carries a new id.
    if (!toast || toast.id === previous.toast?.id) return;

    if (toast.variant === "error") {
      hapticError();
    } else {
      hapticSuccess();
    }
  });
}
