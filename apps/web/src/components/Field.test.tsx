import { render, screen } from "@testing-library/react";

import { Field } from "./Field";

describe("Field", () => {
  it("associates the label with the control, so clicking it focuses", () => {
    render(
      <Field id="label-input" label="Label">
        <input id="label-input" />
      </Field>,
    );

    expect(screen.getByLabelText("Label")).toBe(
      screen.getByRole("textbox"),
    );
  });

  it("announces an error when it appears", () => {
    // Rather than only when focus reaches the field — a form that fails
    // validation silently until you tab into it has failed silently.
    render(
      <Field id="label-input" label="Label" error="Give this plan a label">
        <input id="label-input" aria-describedby="label-input-error" />
      </Field>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Give this plan a label",
    );
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
      "Give this plan a label",
    );
  });

  it("shows no alert region when there is nothing wrong", () => {
    render(
      <Field id="label-input" label="Label">
        <input id="label-input" />
      </Field>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a hint beside the control", () => {
    render(
      <Field id="label-input" label="Label" hint={<span>Searching…</span>}>
        <input id="label-input" />
      </Field>,
    );
    expect(screen.getByText("Searching…")).toBeInTheDocument();
  });
});
