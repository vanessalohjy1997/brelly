import { describeSlotTiming } from "@/utils/describeSlotTiming";

const NOW = new Date(2026, 7, 1, 14, 0); // 1 Aug 2026, 2pm local

function at(hour: number, minute = 0): string {
  return new Date(2026, 7, 1, hour, minute).toISOString();
}

describe("describeSlotTiming", () => {
  it("says a stop in progress is happening now", () => {
    expect(describeSlotTiming(at(13, 30), at(15), NOW)).toEqual({
      relative: "Now",
      isNow: true,
    });
  });

  it("counts a stop as current from the minute it starts", () => {
    // Agrees with `findCurrentOrNextSlot` and `splitPlansByTime`, or the
    // highlighted card and the anchored live readings drift apart.
    expect(describeSlotTiming(at(14), at(15), NOW).isNow).toBe(true);
  });

  it("stops counting it as current at the minute it ends", () => {
    expect(describeSlotTiming(at(13), at(14), NOW)).toEqual({
      relative: null,
      isNow: false,
    });
  });

  it("counts down in minutes within the hour", () => {
    expect(describeSlotTiming(at(14, 40), at(15, 40), NOW).relative).toBe(
      "in 40 min",
    );
  });

  it("counts down in hours beyond one", () => {
    expect(describeSlotTiming(at(17), at(18), NOW).relative).toBe("in 3 hr");
  });

  it("rounds hours down, so a countdown never runs early", () => {
    expect(describeSlotTiming(at(16, 45), at(17, 45), NOW).relative).toBe(
      "in 2 hr",
    );
  });

  it("has a word for the last minute rather than 'in 0 min'", () => {
    const thirtySecondsBefore = new Date(2026, 7, 1, 13, 59, 30);
    expect(
      describeSlotTiming(at(14), at(15), thirtySecondsBefore).relative,
    ).toBe("in under a minute");
  });

  it("falls back to the absolute time beyond the horizon", () => {
    // "in 14 hr" is not something anyone plans against, and the day heading
    // above the card has already said which day it is.
    const tomorrow = new Date(2026, 7, 2, 9, 0).toISOString();
    const tomorrowEnd = new Date(2026, 7, 2, 10, 0).toISOString();

    expect(describeSlotTiming(tomorrow, tomorrowEnd, NOW)).toEqual({
      relative: null,
      isNow: false,
    });
  });

  it("says nothing relative about a stop that is over", () => {
    expect(describeSlotTiming(at(9), at(10), NOW)).toEqual({
      relative: null,
      isNow: false,
    });
  });

  it("falls back rather than guessing when the times don't parse", () => {
    expect(describeSlotTiming("not a date", at(15), NOW)).toEqual({
      relative: null,
      isNow: false,
    });
    expect(describeSlotTiming(at(15), "not a date", NOW)).toEqual({
      relative: null,
      isNow: false,
    });
  });
});
