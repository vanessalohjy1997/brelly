import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChipGroup } from "./ChipGroup";

const options = [
  { value: "outdoor", label: "Outdoor" },
  { value: "indoor", label: "Indoor" },
];

describe("ChipGroup", () => {
  it("is a real radio group, so the browser supplies the keyboard model", () => {
    // The phone gets away with `accessibilityRole="radiogroup"` on a plain
    // container because iOS builds the grouping from the roles. A browser does
    // not: an ARIA radiogroup needs roving focus and arrow-key movement, and
    // half-implementing that promises a widget the keyboard does not deliver.
    render(
      <ChipGroup
        name="kind"
        legend="Indoor or outdoor"
        options={options}
        value="outdoor"
        onChange={jest.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Indoor or outdoor" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Outdoor" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Indoor" })).not.toBeChecked();
  });

  it("reports a selection", async () => {
    const onChange = jest.fn();
    render(
      <ChipGroup
        name="kind"
        legend="Indoor or outdoor"
        options={options}
        value="outdoor"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Indoor" }));

    expect(onChange).toHaveBeenCalledWith("indoor");
  });

  it("moves between options with the arrow keys", async () => {
    const onChange = jest.fn();
    render(
      <ChipGroup
        name="kind"
        legend="Indoor or outdoor"
        options={options}
        value="outdoor"
        onChange={onChange}
      />,
    );

    screen.getByRole("radio", { name: "Outdoor" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("indoor");
  });

  it("gives the unselected chip an edge, and the selected one a fill", () => {
    // An unselected chip is filled with `background-element`, which is what the
    // card behind it is filled with — so without the `border` token it has no
    // boundary and reads as a word rather than as a choice.
    render(
      <ChipGroup
        name="kind"
        legend="Indoor or outdoor"
        options={options}
        value="outdoor"
        onChange={jest.fn()}
      />,
    );

    const selected = screen.getByText("Outdoor").closest("label");
    const unselected = screen.getByText("Indoor").closest("label");

    expect(unselected).toHaveClass("border-border");
    // The selected chip keeps the border box and hides the line, so the row
    // does not shift as the selection moves along it.
    expect(selected).toHaveClass("border-transparent");
    expect(selected).toHaveClass("bg-primary");
  });

  it("keeps the input focusable, so the group can be reached at all", () => {
    render(
      <ChipGroup
        name="kind"
        legend="Indoor or outdoor"
        options={options}
        value="outdoor"
        onChange={jest.fn()}
      />,
    );

    // `sr-only`, not `display: none`: a hidden input is not focusable, which
    // would take the keyboard model with it.
    const radio = screen.getByRole("radio", { name: "Outdoor" });
    radio.focus();
    expect(radio).toHaveFocus();
  });
});
