/**
 * Rewrites an ISO timestamp to fall on `targetDate` (YYYY-MM-DD) while
 * preserving the original's local time-of-day. Used when duplicating or
 * moving a slot to a different day — the user picks a new date, not a new
 * time, so the hour/minute the slot was originally scheduled for should
 * carry over unchanged.
 *
 * Uses local-time `Date` setters (not UTC) so the result is correct
 * regardless of the device's timezone offset from UTC.
 */
export function retargetSlotDate(isoString: string, targetDate: string): string {
  const original = new Date(isoString);
  const [year, month, day] = targetDate.split("-").map(Number);

  const retargeted = new Date(original);
  retargeted.setFullYear(year, month - 1, day);

  return retargeted.toISOString();
}
