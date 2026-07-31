import {
  isWithinQuietHours,
  minutesSinceMidnight,
  nextOccurrenceOfTime,
  parseTimeOfDay,
} from "@/utils/timeOfDay";

describe("parseTimeOfDay", () => {
  it("parses a padded 24-hour time", () => {
    expect(parseTimeOfDay("07:30")).toEqual({ hours: 7, minutes: 30 });
  });

  it("parses an unpadded hour", () => {
    expect(parseTimeOfDay("7:05")).toEqual({ hours: 7, minutes: 5 });
  });

  it("parses midnight and the last minute of the day", () => {
    expect(parseTimeOfDay("00:00")).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeOfDay("23:59")).toEqual({ hours: 23, minutes: 59 });
  });

  it("rejects an out-of-range hour or minute", () => {
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(parseTimeOfDay("12:60")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseTimeOfDay("7:5")).toBeNull();
    expect(parseTimeOfDay("half seven")).toBeNull();
    expect(parseTimeOfDay("")).toBeNull();
  });
});

describe("minutesSinceMidnight", () => {
  it("counts from local midnight", () => {
    expect(minutesSinceMidnight(new Date(2026, 6, 31, 14, 30))).toBe(870);
  });
});

describe("isWithinQuietHours", () => {
  const at = (hours: number, minutes = 0) => new Date(2026, 6, 31, hours, minutes);

  describe("a window that wraps midnight (22:00–07:00)", () => {
    it.each([
      [22, 0, true],
      [23, 30, true],
      [0, 15, true],
      [6, 59, true],
    ])("is quiet at %i:%i", (hours, minutes, expected) => {
      expect(isWithinQuietHours(at(hours, minutes), "22:00", "07:00")).toBe(expected);
    });

    it.each([
      [7, 0],
      [12, 0],
      [21, 59],
    ])("is not quiet at %i:%i", (hours, minutes) => {
      expect(isWithinQuietHours(at(hours, minutes), "22:00", "07:00")).toBe(false);
    });
  });

  describe("a window within one day (13:00–15:00)", () => {
    it("is quiet inside the window", () => {
      expect(isWithinQuietHours(at(14), "13:00", "15:00")).toBe(true);
    });

    it("includes the start and excludes the end", () => {
      expect(isWithinQuietHours(at(13), "13:00", "15:00")).toBe(true);
      expect(isWithinQuietHours(at(15), "13:00", "15:00")).toBe(false);
    });

    it("is not quiet outside the window", () => {
      expect(isWithinQuietHours(at(23), "13:00", "15:00")).toBe(false);
    });
  });

  it("treats an equal start and end as no quiet hours at all", () => {
    expect(isWithinQuietHours(at(9), "09:00", "09:00")).toBe(false);
    expect(isWithinQuietHours(at(3), "09:00", "09:00")).toBe(false);
  });

  it("is false for malformed bounds rather than silencing everything", () => {
    expect(isWithinQuietHours(at(23), "nonsense", "07:00")).toBe(false);
  });
});

describe("nextOccurrenceOfTime", () => {
  it("returns later today when the time hasn't passed", () => {
    const now = new Date(2026, 6, 31, 6, 0);
    expect(nextOccurrenceOfTime("07:30", now)).toEqual(new Date(2026, 6, 31, 7, 30));
  });

  it("rolls to tomorrow when the time has passed", () => {
    const now = new Date(2026, 6, 31, 9, 0);
    expect(nextOccurrenceOfTime("07:30", now)).toEqual(new Date(2026, 7, 1, 7, 30));
  });

  it("rolls to tomorrow when the time is exactly now", () => {
    // Scheduling for "right now" would fire during the app launch that
    // scheduled it.
    const now = new Date(2026, 6, 31, 7, 30, 0, 0);
    expect(nextOccurrenceOfTime("07:30", now)).toEqual(new Date(2026, 7, 1, 7, 30));
  });

  it("crosses a month boundary", () => {
    const now = new Date(2026, 6, 31, 23, 0);
    expect(nextOccurrenceOfTime("07:30", now)).toEqual(new Date(2026, 7, 1, 7, 30));
  });

  it("zeroes seconds so the trigger lands on the minute", () => {
    const now = new Date(2026, 6, 31, 6, 0, 45, 500);
    expect(nextOccurrenceOfTime("07:30", now)?.getSeconds()).toBe(0);
  });

  it("returns null for a malformed time", () => {
    expect(nextOccurrenceOfTime("oops", new Date())).toBeNull();
  });
});
