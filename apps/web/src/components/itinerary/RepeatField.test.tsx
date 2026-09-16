import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RepeatRule } from "@brelly/core";

import { RepeatField } from "./RepeatField";

/** A Tuesday, so "the day the stop is already on" is unambiguous. */
const anchor = new Date(2026, 8, 15, 9, 0);

function setup(value: RepeatRule | null = null) {
  const onChange = jest.fn();
  const view = render(
    <RepeatField value={value} onChange={onChange} anchor={anchor} />,
  );
  return { onChange, view };
}

describe("RepeatField", () => {
  it("starts as a one-off and shows nothing else", () => {
    setup();

    expect(screen.getByRole("radio", { name: "Just once" })).toBeChecked();
    expect(screen.queryByRole("group", { name: "Days" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Ends" })).not.toBeInTheDocument();
  });

  it("seeds a weekly rule with the day the stop is already on", async () => {
    // A routine that repeated on some *other* day than the one just picked
    // would be a surprise.
    const { onChange } = setup();

    await userEvent.click(screen.getByRole("radio", { name: "Weekly" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: "weekly", weekdays: [2] }),
    );
  });

  it("seeds a monthly rule with the stop's own date, and offers no day chips", async () => {
    const { onChange } = setup();

    await userEvent.click(screen.getByRole("radio", { name: "Monthly" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: "monthly", dayOfMonth: 15 }),
    );
  });

  it("has no day controls at all on a monthly rule", () => {
    // Moving the Day field above moves the recurrence date with it, so a
    // separate control would be a second answer to one question.
    setup({ frequency: "monthly", weekdays: [], dayOfMonth: 15 });

    expect(screen.queryByRole("group", { name: "Days" })).not.toBeInTheDocument();
  });

  it("follows the anchor when the stop moves to another date", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <RepeatField
        value={{ frequency: "monthly", weekdays: [], dayOfMonth: 15 }}
        onChange={onChange}
        anchor={anchor}
      />,
    );
    onChange.mockClear();

    rerender(
      <RepeatField
        value={{ frequency: "monthly", weekdays: [], dayOfMonth: 15 }}
        onChange={onChange}
        anchor={new Date(2026, 8, 20, 9, 0)}
      />,
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dayOfMonth: 20 }),
    );
  });

  it("names each weekday, because the glyphs collide", async () => {
    // Two days share the letter "T" and two share "S".
    const { onChange } = setup({ frequency: "weekly", weekdays: [2] });

    expect(screen.getByRole("checkbox", { name: "Tue" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Thu" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("checkbox", { name: "Thu" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ weekdays: [2, 4] }),
    );
  });

  it("toggles a selected day back off", async () => {
    const { onChange } = setup({ frequency: "weekly", weekdays: [2, 4] });

    await userEvent.click(screen.getByRole("checkbox", { name: "Tue" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ weekdays: [4] }),
    );
  });

  it("offers the two shapes a week almost always takes", async () => {
    const { onChange } = setup({ frequency: "weekly", weekdays: [2] });

    await userEvent.click(screen.getByRole("button", { name: "Mon–Fri" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ weekdays: [1, 2, 3, 4, 5] }),
    );
  });

  it("seeds an end date a fortnight-and-a-half out for a weekly rule", async () => {
    const { onChange } = setup({ frequency: "weekly", weekdays: [2] });

    await userEvent.click(screen.getByRole("radio", { name: "On a date" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ endDate: "2026-10-13" }),
    );
  });

  it("seeds a monthly rule's end date months out instead", async () => {
    // At +28 days a monthly rule would barely reach one occurrence, so "On a
    // date" would read as "next month" rather than as a real bound.
    const { onChange } = setup({
      frequency: "monthly",
      weekdays: [],
      dayOfMonth: 15,
    });

    await userEvent.click(screen.getByRole("radio", { name: "On a date" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ endDate: "2026-12-15" }),
    );
  });

  it("reads the rule back in words", () => {
    // The chips say what was pressed; this says what it means, which is the
    // thing a routine is easy to be wrong about.
    setup({ frequency: "weekly", weekdays: [1, 2, 3, 4, 5] });

    // Not /Mon/: the "Mon–Fri" preset button carries that text too.
    expect(screen.getByText("Repeats Mon–Fri")).toBeInTheDocument();
  });

  it("shows an error where the field is, not in a pile", () => {
    render(
      <RepeatField
        value={{ frequency: "weekly", weekdays: [] }}
        onChange={jest.fn()}
        anchor={anchor}
        error="Pick at least one day"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Pick at least one day");
  });
});
