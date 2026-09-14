const DEFAULT_LEAD_MINUTES = 45;

/**
 * When to fire a "bring an umbrella" notification for a slot: `leadMinutes`
 * before it starts. Returns null if that moment has already passed (e.g.
 * the slot starts too soon, or is already in the past) — there's nothing
 * useful to schedule at that point.
 */
export function computeNotificationTriggerTime(
  slotStartTime: string,
  leadMinutes: number = DEFAULT_LEAD_MINUTES,
): Date | null {
  const slotStart = new Date(slotStartTime);
  const triggerTime = new Date(slotStart.getTime() - leadMinutes * 60 * 1000);

  return triggerTime.getTime() > Date.now() ? triggerTime : null;
}
