import { describeRoutine, describeWeekdays } from "@/utils/describeRoutine";

describe("describeWeekdays", () => {
  it("names whole blocks by their shape rather than listing them", () => {
    expect(describeWeekdays([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(describeWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe("every day");
    expect(describeWeekdays([0, 6])).toBe("weekends");
  });

  it("lists anything else in week order, Monday first", () => {
    // Given out of order on purpose: the chips are toggled in whatever order
    // they're tapped, and the sentence should read the same either way.
    expect(describeWeekdays([4, 2])).toBe("Tue, Thu");
    expect(describeWeekdays([0, 3])).toBe("Wed, Sun");
  });

  it("says nothing when nothing is selected", () => {
    expect(describeWeekdays([])).toBe("");
  });
});

describe("describeRoutine", () => {
  it("promises the days it repeats on", () => {
    expect(describeRoutine({ weekdays: [1, 2, 3, 4, 5] })).toBe(
      "Repeats Mon–Fri",
    );
  });

  it("names the end date when there is one", () => {
    expect(
      describeRoutine({ weekdays: [2, 4], endDate: "2026-12-31" }),
    ).toBe("Repeats Tue, Thu until 31 December");
  });

  it("returns null with no days, so the caller renders no row at all", () => {
    expect(describeRoutine({ weekdays: [] })).toBeNull();
  });
});
