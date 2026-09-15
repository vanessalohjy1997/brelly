import { Alert } from "react-native";

/**
 * Sign-out needs asking, unlike a delete, because it is the one action here
 * that undo cannot cover: it swaps the whole device onto a fresh anonymous
 * account in one step, and a toast with an "Undo" would have to re-enter a
 * password it never held.
 *
 * The message says what survives, which is the part people get wrong — the
 * account keeps everything, and signing back in brings it all back. Without
 * that, "Sign out" reads like "delete my plans".
 *
 * Resolves `false` on Cancel or on dismissal without a button pressed, the
 * same unanswered-question convention as `promptMergeChoice`.
 */
export function confirmSignOut(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Sign out?",
      "Your plans, routines, and settings stay in the account and come back when you sign in again. This device goes back to keeping them on its own.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { onDismiss: () => resolve(false) },
    );
  });
}
