import {
  FREQUENCY_LABELS,
  resolveFrequency,
  ROUTINE_FREQUENCIES,
} from "./routineFrequency";

describe("resolveFrequency", () => {
  it("reads an absent frequency as weekly, so old routines don't change", () => {
    // Every routine created before monthly existed has no `frequency` field,
    // and must keep the weekly behaviour it was written under.
    expect(resolveFrequency(undefined)).toBe("weekly");
  });

  it("passes an explicit frequency through", () => {
    expect(resolveFrequency("weekly")).toBe("weekly");
    expect(resolveFrequency("monthly")).toBe("monthly");
  });
});

describe("FREQUENCY_LABELS", () => {
  it("labels every frequency the app knows", () => {
    for (const frequency of ROUTINE_FREQUENCIES) {
      expect(FREQUENCY_LABELS[frequency]).toBeTruthy();
    }
  });
});
