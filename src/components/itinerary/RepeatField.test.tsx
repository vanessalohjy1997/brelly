import { fireEvent } from "@testing-library/react-native";

import { RepeatField } from "@/components/itinerary/RepeatField";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { RepeatRule } from "@/types/routine";

/** 5 Aug 2026 is a Wednesday — day 3, so a fresh repeat should start there. */
const WEDNESDAY = new Date(2026, 7, 5, 9, 0);

async function renderField(value: RepeatRule | null, error?: string) {
  const onChange = jest.fn();
  const view = await renderWithProviders(
    <RepeatField
      value={value}
      onChange={onChange}
      anchor={WEDNESDAY}
      error={error}
    />,
  );
  return { ...view, onChange };
}

describe("RepeatField", () => {
  it("starts on Once, and says the plan is a one-off", async () => {
    const view = await renderField(null);

    expect(view.getByText("Just this one.")).toBeTruthy();
    // The day toggles only exist once there is something to repeat.
    expect(view.queryByLabelText("Mon")).toBeNull();
  });

  it("seeds a new repeat with the day the stop is already on", async () => {
    // Repeating on some *other* day than the one just picked is a surprise.
    const { onChange, ...view } = await renderField(null);

    await fireEvent.press(view.getByText("Every week"));

    expect(onChange).toHaveBeenCalledWith({ weekdays: [3] });
  });

  it("returns to a one-off, dropping the rule", async () => {
    const { onChange, ...view } = await renderField({ weekdays: [1, 3] });

    await fireEvent.press(view.getByText("Just once"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("turns a day on", async () => {
    const { onChange, ...view } = await renderField({ weekdays: [3] });

    await fireEvent.press(view.getByLabelText("Fri"));

    expect(onChange).toHaveBeenCalledWith({ weekdays: [3, 5] });
  });

  it("turns a day back off", async () => {
    const { onChange, ...view } = await renderField({ weekdays: [3, 5] });

    await fireEvent.press(view.getByLabelText("Fri"));

    expect(onChange).toHaveBeenCalledWith({ weekdays: [3] });
  });

  it("names the days rather than lettering them, since two days share a T", async () => {
    const view = await renderField({ weekdays: [] });

    expect(view.getByLabelText("Tue")).toBeTruthy();
    expect(view.getByLabelText("Thu")).toBeTruthy();
    expect(view.getByLabelText("Sat")).toBeTruthy();
    expect(view.getByLabelText("Sun")).toBeTruthy();
  });

  it("sets a whole working week in one tap", async () => {
    const { onChange, ...view } = await renderField({ weekdays: [3] });

    await fireEvent.press(view.getByText("Mon–Fri"));

    expect(onChange).toHaveBeenCalledWith({ weekdays: [1, 2, 3, 4, 5] });
  });

  it("says what the rule means in words", async () => {
    const view = await renderField({ weekdays: [1, 2, 3, 4, 5] });

    expect(view.getByText("Repeats Mon–Fri")).toBeTruthy();
  });

  it("ends never until a date is chosen", async () => {
    const { onChange, ...view } = await renderField({ weekdays: [3] });

    await fireEvent.press(view.getByText("On a date"));

    // Four weeks out from the day the stop is on.
    expect(onChange).toHaveBeenCalledWith({
      weekdays: [3],
      endDate: "2026-09-02",
    });
  });

  it("clears the end date again", async () => {
    const { onChange, ...view } = await renderField({
      weekdays: [3],
      endDate: "2026-09-02",
    });

    await fireEvent.press(view.getByText("Never"));

    expect(onChange).toHaveBeenCalledWith({
      weekdays: [3],
      endDate: undefined,
    });
  });

  it("shows the end-date picker only once there is an end date", async () => {
    const withoutEnd = await renderField({ weekdays: [3] });
    expect(withoutEnd.queryByTestId("datetime-picker-date")).toBeNull();

    const withEnd = await renderField({ weekdays: [3], endDate: "2026-09-02" });
    expect(withEnd.getByTestId("datetime-picker-date")).toBeTruthy();
  });

  it("shows an error in place of the hint, so they can't be read as one line", async () => {
    const view = await renderField({ weekdays: [] }, "Pick at least one day");

    expect(view.getByText("Pick at least one day")).toBeTruthy();
    expect(view.queryByText("Just this one.")).toBeNull();
  });
});
