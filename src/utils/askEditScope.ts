import { Alert } from "react-native";

export type EditScope = "day" | "series";

type Options = {
  title: string;
  message: string;
  /** Wording for the single-day action — "Save this day only", "Delete this day". */
  dayLabel: string;
  /** Wording for the whole-routine action. Omitted when it isn't offered. */
  seriesLabel?: string;
  /** The series action removes or rewrites future days, so it reads as destructive. */
  destructive?: boolean;
};

/**
 * Asks whether a change to one day of a routine means that day or the rule.
 *
 * The question is unavoidable: a stop produced by a routine is two things at
 * once, and only the person editing it knows which one they meant. Guessing
 * either way is silently wrong half the time — "just this day" quietly stops a
 * routine from being one, and "all of them" rewrites a fortnight because
 * somebody moved a single lunch.
 *
 * Resolves `null` when dismissed, which the callers read as "leave everything
 * alone and stay on the form" — an unanswered question must not commit.
 *
 * `seriesLabel` is optional because moving a stop to another *day* can only
 * mean that day: a routine has no single date, so there is no rule-level
 * reading of "this now happens on Thursday instead".
 */
export function askEditScope(options: Options): Promise<EditScope | null> {
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        { text: options.dayLabel, onPress: () => resolve("day") },
        ...(options.seriesLabel
          ? [
              {
                text: options.seriesLabel,
                style: options.destructive
                  ? ("destructive" as const)
                  : undefined,
                onPress: () => resolve("series"),
              },
            ]
          : []),
      ],
      // Android's back button and an iOS tap outside both dismiss without
      // pressing anything, and a promise nobody settles leaves the save
      // half-done forever.
      { onDismiss: () => resolve(null) },
    );
  });
}
