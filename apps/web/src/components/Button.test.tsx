import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "./Button";

describe("Button", () => {
  it("holds the 44px target the phone gets from hitSlop", () => {
    // There is no `hitSlop` in CSS — a target cannot be extended past its own
    // box — so the box is padded instead, once, here.
    render(<Button onClick={jest.fn()}>Add</Button>);
    expect(screen.getByRole("button")).toHaveClass(
      "min-h-[var(--brelly-hit-target)]",
    );
  });

  it("pairs each tone's background with its own text colour", () => {
    // `onPrimary` and `onDanger` are separate tokens precisely because white is
    // not safe on both themes: the dark theme's `danger` is the lighter of the
    // pair, and white on it is 2.34:1.
    const { rerender } = render(<Button tone="danger">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-danger");
    expect(screen.getByText("Delete")).toHaveClass("text-on-danger");

    rerender(<Button tone="primary">Add</Button>);
    expect(screen.getByText("Add")).toHaveClass("text-on-primary");
  });

  it("dims and stops responding when disabled", async () => {
    const onClick = jest.fn();
    render(
      <Button onClick={onClick} disabled>
        Add
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("can be named where nothing visible names it", () => {
    render(<Button label="Add a plan">+</Button>);
    expect(screen.getByRole("button", { name: "Add a plan" })).toBeInTheDocument();
  });
});
