import { askDialog } from "@/store/dialogStore";

export type MergeChoice = "add" | "dont-add" | "cancel";

/**
 * A real choice, not a formality: a user signing in on a borrowed browser does
 * not want their throwaway plans merged into the account they just joined.
 *
 * Three buttons, which is why `window.confirm` could never have stood in for
 * this. Resolves `"cancel"` on Cancel or on dismissal — both read as "leave
 * everything alone", matching `askEditScope`'s convention.
 */
export async function promptMergeChoice(
  planCount: number,
  routineCount: number,
): Promise<MergeChoice> {
  const answer = await askDialog({
    title: "That account already has data",
    message: `Add your ${planCount} plan${planCount === 1 ? "" : "s"} and ${routineCount} routine${routineCount === 1 ? "" : "s"} to it?`,
    dismissKey: "cancel",
    actions: [
      { key: "add", label: "Add" },
      { key: "dont-add", label: "Don't add" },
      { key: "cancel", label: "Cancel", tone: "cancel" },
    ],
  });

  return answer === "add" || answer === "dont-add" ? answer : "cancel";
}
