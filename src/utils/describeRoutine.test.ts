import { describeRoutine, describeWeekdays, ordinal } from "@/utils/describeRoutine";

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

  describe("monthly", () => {
    it("promises the day of the month it repeats on", () => {
      expect(
        describeRoutine({ frequency: "monthly", weekdays: [], dayOfMonth: 15 }),
      ).toBe("Repeats on the 15th");
    });

    it("appends the end date the same way weekly does", () => {
      expect(
        describeRoutine({
          frequency: "monthly",
          weekdays: [],
          dayOfMonth: 1,
          endDate: "2026-12-31",
        }),
      ).toBe("Repeats on the 1st until 31 December");
    });

    it("returns null with no day of the month, so the caller renders no row", () => {
      expect(describeRoutine({ frequency: "monthly", weekdays: [] })).toBeNull();
    });
  });
});

describe("ordinal", () => {
  it("suffixes 1/2/3 as st/nd/rd", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
  });

  it("keeps the 11th–13th on 'th', the exception the rule of thumb forgets", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("suffixes the 21st, 22nd, 23rd and 31st by their last digit", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
    expect(ordinal(31)).toBe("31st");
  });
});
