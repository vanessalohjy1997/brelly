import { askDialog } from "@/store/dialogStore";

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
 * Same question, same wording and same contract as the mobile utility of this
 * name — only the renderer differs. Resolves `null` when dismissed, which every
 * caller reads as "leave everything alone": the form stays open, and a row
 * action changes nothing.
 *
 * `seriesLabel` is optional because moving a stop to another *day* can only
 * mean that day: a routine has no single date, so there is no rule-level
 * reading of "this now happens on Thursday instead".
 */
export async function askEditScope(
  options: Options,
): Promise<EditScope | null> {
  const answer = await askDialog({
    title: options.title,
    message: options.message,
    dismissKey: "cancel",
    actions: [
      { key: "day", label: options.dayLabel },
      ...(options.seriesLabel
        ? [
            {
              key: "series",
              label: options.seriesLabel,
              tone: options.destructive
                ? ("destructive" as const)
                : ("default" as const),
            },
          ]
        : []),
      { key: "cancel", label: "Cancel", tone: "cancel" as const },
    ],
  });

  if (answer === "day" || answer === "series") return answer;
  return null;
}
