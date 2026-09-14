const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago a reading was issued, compactly enough for the weather badge
 * ("just now", "12m ago", "3h ago", "2d ago").
 *
 * Returns null for a missing or unparseable timestamp, and for one in the
 * future — NEA timestamps carry a +08:00 offset, so a device with a skewed
 * clock can produce a small negative age, and "in -2 minutes" is worse than
 * showing nothing.
 */
export function formatRelativeTimestamp(
  timestamp: string | undefined,
  now: Date = new Date(),
): string | null {
  if (!timestamp) return null;

  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return null;

  const elapsed = now.getTime() - then;
  if (elapsed < 0) return null;
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;

  return `${Math.floor(elapsed / DAY)}d ago`;
}
