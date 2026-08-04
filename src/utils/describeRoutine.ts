import type { RepeatRule } from "@/types/routine";
import { parseDateKey } from "@/utils/dateKeys";

/** Monday first, because that is how a week reads on a schedule. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

/** The single letter on a day toggle. Two days share "T" and two share "S". */
export const WEEKDAY_INITIALS: Record<number, string> = {
  0: "S",
  1: "M",
  2: "T",
  3: "W",
  4: "T",
  5: "F",
  6: "S",
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function sameDays(days: number[], other: number[]): boolean {
  return (
    days.length === other.length && other.every((day) => days.includes(day))
  );
}

/**
 * The selected days, in week order and named.
 *
 * The two whole-block cases get their own wording because "Mon, Tue, Wed, Thu,
 * Fri" is a list you have to read, and "Mon–Fri" is a shape you recognise.
 */
export function describeWeekdays(weekdays: number[]): string {
  if (weekdays.length === 0) return "";
  if (sameDays(weekdays, EVERY_DAY)) return "every day";
  if (sameDays(weekdays, WEEKDAYS)) return "Mon–Fri";
  if (sameDays(weekdays, [0, 6])) return "weekends";

  return WEEKDAY_ORDER.filter((day) => weekdays.includes(day))
    .map((day) => WEEKDAY_LABELS[day])
    .join(", ");
}

/**
 * What the repeat promises, for the hint under the form and the line on the
 * edit screen: "Repeats Mon–Fri", "Repeats Tue, Thu until 31 December".
 *
 * Returns null when there is nothing to promise, so the caller can render
 * nothing rather than an empty row.
 */
export function describeRoutine(rule: RepeatRule): string | null {
  if (rule.weekdays.length === 0) return null;

  const days = describeWeekdays(rule.weekdays);
  if (!rule.endDate) return `Repeats ${days}`;

  const until = parseDateKey(rule.endDate).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
  });
  return `Repeats ${days} until ${until}`;
}
