import { askDialog } from "@/store/dialogStore";

/**
 * Sign-out needs asking, unlike a delete, because it is the one action here
 * that undo cannot cover: it swaps the whole session onto a fresh anonymous
 * account in one step, and a toast with an "Undo" would have to re-enter a
 * password it never held.
 *
 * The message says what survives, which is the part people get wrong — the
 * account keeps everything, and signing back in brings it all back. Without
 * that, "Sign out" reads like "delete my plans".
 *
 * Resolves `false` on Cancel or on dismissal, the same unanswered-question
 * convention as `promptMergeChoice`.
 */
export async function confirmSignOut(): Promise<boolean> {
  const answer = await askDialog({
    title: "Sign out?",
    message:
      "Your plans, routines, and settings stay in the account and come back when you sign in again. This browser goes back to keeping them on its own.",
    dismissKey: "cancel",
    actions: [
      { key: "sign-out", label: "Sign out", tone: "destructive" },
      { key: "cancel", label: "Cancel", tone: "cancel" },
    ],
  });

  return answer === "sign-out";
}
