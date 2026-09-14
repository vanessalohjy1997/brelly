import {
  MinTimePickerWidth,
  shouldStackDateTimeFields,
} from "@/utils/shouldStackDateTimeFields";

describe("shouldStackDateTimeFields", () => {
  it("stays side by side on a phone-width form", () => {
    // 390pt screen (iPhone 14/15) minus 16pt padding either side — two
    // `mode="time"` capsules comfortably fit this width, unlike the old
    // `mode="datetime"` pair this check used to guard.
    expect(shouldStackDateTimeFields(390 - 32, 16)).toBe(false);
  });

  it("stays side by side on a tablet-width form", () => {
    // 1024pt screen (iPad landscape) minus 16pt padding either side
    expect(shouldStackDateTimeFields(1024 - 32, 16)).toBe(false);
  });

  it("needs room for both pickers and the gap between them", () => {
    const exactFit = MinTimePickerWidth * 2 + 16;
    expect(shouldStackDateTimeFields(exactFit, 16)).toBe(false);
    expect(shouldStackDateTimeFields(exactFit - 1, 16)).toBe(true);
  });

  it("counts the gap against the available width", () => {
    const bothPickers = MinTimePickerWidth * 2;
    expect(shouldStackDateTimeFields(bothPickers, 0)).toBe(false);
    expect(shouldStackDateTimeFields(bothPickers, 1)).toBe(true);
  });

  it("stacks on a very narrow form", () => {
    // Small enough that even two time-only capsules can't fit side by side.
    expect(shouldStackDateTimeFields(150, 16)).toBe(true);
  });
});
