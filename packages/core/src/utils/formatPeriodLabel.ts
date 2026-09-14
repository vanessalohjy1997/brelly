/**
 * Labels a 24hr-forecast period by its local start hour. NEA's periods don't
 * carry a name of their own — just a start/end timestamp — and roughly
 * follow this Morning/Afternoon/Night split in practice.
 */
export function formatPeriodLabel(start: string | Date): "Morning" | "Afternoon" | "Night" {
  const date = typeof start === "string" ? new Date(start) : start;
  const hour = date.getHours();

  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Afternoon";
  return "Night";
}
