import { fireEvent, waitFor } from "@testing-library/react-native";

import { RepeatField } from "@/components/itinerary/RepeatField";
import { renderWithProviders } from "@/test/renderWithProviders";
import { type RepeatRule } from "@brelly/core";

/**
 * 5 Aug 2026 is a Wednesday — day 3 of the week, the 5th of the month. A fresh
 * weekly repeat should start on the Wednesday; a monthly one on the 5th.
 */
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

  it("seeds a new weekly repeat with the day the stop is already on", async () => {
    // Repeating on some *other* day than the one just picked is a surprise.
    const { onChange, ...view } = await renderField(null);

    await fireEvent.press(view.getByText("Weekly"));

    expect(onChange).toHaveBeenCalledWith({
      frequency: "weekly",
      weekdays: [3],
    });
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

  describe("monthly", () => {
    it("seeds a monthly repeat with the stop's own day of the month", async () => {
      // The 5th, because the stop sits on 5 Aug — the same "start from the day
      // you picked" rule the weekly seed follows.
      const { onChange, ...view } = await renderField(null);

      await fireEvent.press(view.getByText("Monthly"));

      expect(onChange).toHaveBeenCalledWith({
        frequency: "monthly",
        weekdays: [],
        dayOfMonth: 5,
      });
    });

    it("drops the weekday toggles and presets — a monthly rule has no days to pick", async () => {
      const view = await renderField({
        frequency: "monthly",
        weekdays: [],
        dayOfMonth: 5,
      });

      expect(view.queryByLabelText("Mon")).toBeNull();
      expect(view.queryByText("Mon–Fri")).toBeNull();
      // The Ends control still belongs to a monthly rule.
      expect(view.getByText("Never")).toBeTruthy();
    });

    it("says the monthly rule in words", async () => {
      const view = await renderField({
        frequency: "monthly",
        weekdays: [],
        dayOfMonth: 5,
      });

      expect(view.getByText("Repeats on the 5th")).toBeTruthy();
    });

    it("moves the recurrence date when the stop's day moves", async () => {
      // The rule falls on the stop's own date, so pushing the Day field to the
      // 20th has to move the recurrence to the 20th with it.
      const onChange = jest.fn();
      const TWENTIETH = new Date(2026, 7, 20, 9, 0);
      await renderWithProviders(
        <RepeatField
          value={{ frequency: "monthly", weekdays: [], dayOfMonth: 5 }}
          onChange={onChange}
          anchor={TWENTIETH}
        />,
      );

      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({
          frequency: "monthly",
          weekdays: [],
          dayOfMonth: 20,
        }),
      );
    });

    it("opens its end-date months out, not the weekly four weeks", async () => {
      // +28d barely reaches one monthly occurrence, so "On a date" seeds a few
      // months ahead instead: 5 Aug → 5 Nov.
      const { onChange, ...view } = await renderField({
        frequency: "monthly",
        weekdays: [],
        dayOfMonth: 5,
      });

      await fireEvent.press(view.getByText("On a date"));

      expect(onChange).toHaveBeenCalledWith({
        frequency: "monthly",
        weekdays: [],
        dayOfMonth: 5,
        endDate: "2026-11-05",
      });
    });
  });
});
