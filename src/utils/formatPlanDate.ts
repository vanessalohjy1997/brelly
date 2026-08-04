import { parseDateKey, shiftDays } from "@/utils/dateKeys";

/**
 * A day's heading, relative to today where a name is more useful than a date.
 *
 * "Yesterday" matters as much as "Tomorrow" now that finished stops have an
 * archive to sit in — the top of that list is almost always the last day or
 * two. `todayDate` is passed in rather than read from the clock so the wording
 * can be tested without freezing time.
 */
export function formatPlanDate(date: string, todayDate: string): string {
  if (date === todayDate) return "Today";
  if (date === shiftDays(todayDate, 1)) return "Tomorrow";
  if (date === shiftDays(todayDate, -1)) return "Yesterday";

  return parseDateKey(date).toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
