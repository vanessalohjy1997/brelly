import { shouldNotifyForRain } from "@/utils/shouldNotifyForRain";

export type DigestEntry = {
  label: string;
  startTime: string; // ISO
  /** Forecast text, or null if it couldn't be determined. */
  forecastText: string | null;
};

export type DigestMessage = { title: string; body: string };

/**
 * The one-notification summary of a day's plans.
 *
 * Returns null when there's nothing to say — no plans that day — because a
 * notification reading "0 stops today" is worse than silence.
 */
export function buildDigestMessage(
  entries: DigestEntry[],
  now: Date = new Date(),
): DigestMessage | null {
  if (entries.length === 0) return null;

  const wet = entries.filter(
    (entry) => entry.forecastText !== null && shouldNotifyForRain(entry.forecastText),
  );
  const stops = `${entries.length} ${entries.length === 1 ? "stop" : "stops"}`;
  const title = isToday(entries[0].startTime, now) ? "Today's plans" : "Your plans";

  if (wet.length === 0) {
    return { title, body: `${stops}, no rain forecast.` };
  }

  // Naming the wet stops is the actionable part — "bring an umbrella" alone
  // doesn't say which part of the day to plan around.
  const named = wet
    .slice(0, MAX_NAMED)
    .map((entry) => `${entry.label} (${formatTime(entry.startTime)})`)
    .join(", ");
  const overflow = wet.length - MAX_NAMED;
  const tail = overflow > 0 ? `, +${overflow} more` : "";

  return {
    title: "Umbrella today",
    body: `${stops}, rain expected for ${named}${tail}.`,
  };
}

// Notification bodies are truncated by the OS at roughly two lines, so naming
// every wet stop on a busy day would push the count off the end.
const MAX_NAMED = 2;

function formatTime(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isToday(isoTime: string, now: Date): boolean {
  const date = new Date(isoTime);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
