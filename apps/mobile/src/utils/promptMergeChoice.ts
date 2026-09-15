import { Alert } from "react-native";

export type MergeChoice = "add" | "dont-add" | "cancel";

/**
 * Requirement 2's "option" — FIREBASE_MIGRATION.md's "Account linking",
 * step 3. A real choice, not a formality: a user signing in on a borrowed
 * device does not want their throwaway plans merged into the account they
 * just joined.
 *
 * Resolves `"cancel"` on Cancel or on dismissal without a button pressed —
 * both read as "leave everything alone", matching `askEditScope`'s
 * unanswered-question convention.
 */
export function promptMergeChoice(
  planCount: number,
  routineCount: number,
): Promise<MergeChoice> {
  return new Promise((resolve) => {
    Alert.alert(
      "That account already has data",
      `Add your ${planCount} plan${planCount === 1 ? "" : "s"} and ${routineCount} routine${routineCount === 1 ? "" : "s"} to it?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
        { text: "Don't add", onPress: () => resolve("dont-add") },
        { text: "Add", onPress: () => resolve("add") },
      ],
      { onDismiss: () => resolve("cancel") },
    );
  });
}
