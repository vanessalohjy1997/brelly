import {
  MinDateTimePickerWidth,
  shouldStackDateTimeFields,
} from "@/utils/shouldStackDateTimeFields";

describe("shouldStackDateTimeFields", () => {
  it("stacks on a phone-width form", () => {
    // 390pt screen (iPhone 14/15) minus 16pt padding either side
    expect(shouldStackDateTimeFields(390 - 32, 16)).toBe(true);
  });

  it("stays side by side on a tablet-width form", () => {
    // 1024pt screen (iPad landscape) minus 16pt padding either side
    expect(shouldStackDateTimeFields(1024 - 32, 16)).toBe(false);
  });

  it("needs room for both pickers and the gap between them", () => {
    const exactFit = MinDateTimePickerWidth * 2 + 16;
    expect(shouldStackDateTimeFields(exactFit, 16)).toBe(false);
    expect(shouldStackDateTimeFields(exactFit - 1, 16)).toBe(true);
  });

  it("counts the gap against the available width", () => {
    const bothPickers = MinDateTimePickerWidth * 2;
    expect(shouldStackDateTimeFields(bothPickers, 0)).toBe(false);
    expect(shouldStackDateTimeFields(bothPickers, 1)).toBe(true);
  });
});
