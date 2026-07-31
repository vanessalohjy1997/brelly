import { formatRelativeTimestamp } from "@/utils/formatRelativeTimestamp";

// NEA stamps its responses with a +08:00 offset rather than Z — using the
// real format here so the parsing is exercised the way production sees it.
const NOW = new Date("2026-07-31T14:00:00+08:00");

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60 * 1000).toISOString();
}

describe("formatRelativeTimestamp", () => {
  it("says 'just now' for under a minute", () => {
    expect(formatRelativeTimestamp(minutesAgo(0.5), NOW)).toBe("just now");
  });

  it("counts minutes under an hour", () => {
    expect(formatRelativeTimestamp(minutesAgo(12), NOW)).toBe("12m ago");
  });

  it("rolls over to hours at 60 minutes", () => {
    expect(formatRelativeTimestamp(minutesAgo(60), NOW)).toBe("1h ago");
    expect(formatRelativeTimestamp(minutesAgo(59), NOW)).toBe("59m ago");
  });

  it("counts hours under a day", () => {
    expect(formatRelativeTimestamp(minutesAgo(8 * 60), NOW)).toBe("8h ago");
  });

  it("rolls over to days at 24 hours", () => {
    expect(formatRelativeTimestamp(minutesAgo(24 * 60), NOW)).toBe("1d ago");
  });

  it("parses NEA's +08:00 offset timestamps", () => {
    expect(
      formatRelativeTimestamp("2026-07-31T11:40:57+08:00", NOW),
    ).toBe("2h ago");
  });

  it("returns null for a missing timestamp", () => {
    expect(formatRelativeTimestamp(undefined, NOW)).toBeNull();
  });

  it("returns null for an unparseable timestamp", () => {
    expect(formatRelativeTimestamp("not a date", NOW)).toBeNull();
  });

  it("returns null for a future timestamp rather than a negative age", () => {
    expect(formatRelativeTimestamp(minutesAgo(-5), NOW)).toBeNull();
  });
});
