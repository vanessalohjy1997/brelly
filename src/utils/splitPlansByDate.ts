import type { DayPlan } from "@/types/itinerary";

/**
 * Splits plans into "upcoming" (today or later) and "past" (before today),
 * so the Plans tab can keep past plans out of the way by default instead of
 * letting the list grow forever. Dates are plain "YYYY-MM-DD" strings, which
 * sort lexically the same as chronologically, so no Date parsing is needed.
 */
export function splitPlansByDate(
  plans: DayPlan[],
  todayDate: string,
): { upcoming: DayPlan[]; past: DayPlan[] } {
  const upcoming = plans
    .filter((p) => p.date >= todayDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const past = plans
    .filter((p) => p.date < todayDate)
    .sort((a, b) => b.date.localeCompare(a.date)); // most recent first

  return { upcoming, past };
}
