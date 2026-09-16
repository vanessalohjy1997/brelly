import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button, buttonClassName } from "./Button";

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

  it("gives the quiet tone an edge, because its fill is the card's", () => {
    // The bug this fixes: `quiet` was `bg-background-element` and nothing else,
    // which is exactly what `Surface` fills a card with — so every quiet button
    // on Settings was a label floating on a card with no boundary at all.
    render(<Button tone="quiet">Export data</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("border-border");
    expect(button).toHaveClass("hover:bg-background-selected");
  });

  it("keeps a filled tone's box the same height as an outlined one's", () => {
    // `border-transparent` rather than no border: a row mixing tones lines up
    // only if every tone reserves the same 2px.
    render(<Button tone="primary">Add</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-transparent");
  });

  it("shows a pointer, and stops showing one when it will not respond", () => {
    // Tailwind's reset gives `<button>` `cursor: default`. On a pointer that is
    // half the reason a flat control does not read as clickable.
    const { rerender } = render(<Button onClick={jest.fn()}>Add</Button>);
    expect(screen.getByRole("button")).toHaveClass("cursor-pointer");

    rerender(
      <Button onClick={jest.fn()} disabled>
        Add
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveClass(
      "disabled:cursor-not-allowed",
    );
  });

  it("hands the same look to a link that is shaped like a button", () => {
    // Three `next/link`s are genuinely navigations and have to stay anchors.
    // They used to hand-copy a subset of these classes, which is how they
    // drifted out of the fix above.
    const quiet = buttonClassName("quiet");
    render(<Button tone="quiet">Export data</Button>);
    const button = screen.getByRole("button");

    for (const className of quiet.split(" ")) {
      expect(button).toHaveClass(className);
    }
  });

  it("centres an icon against its label instead of sitting it on the baseline", () => {
    // The bug: every child went into one `Text`, so the button's own
    // `items-center gap-two` had a single item to centre and no pair to space,
    // and the icon fell back to inline layout — where its box sits on the
    // baseline, the bottom of the text rather than its middle.
    render(
      <Button tone="quiet">
        <span data-testid="icon" />
        Refresh
      </Button>,
    );

    const row = screen.getByTestId("icon").parentElement;
    expect(row).toHaveClass("inline-flex");
    expect(row).toHaveClass("items-center");
    expect(row).toHaveClass("gap-two");
  });

  it("can be named where nothing visible names it", () => {
    render(<Button label="Add a plan">+</Button>);
    expect(
      screen.getByRole("button", { name: "Add a plan" }),
    ).toBeInTheDocument();
  });
});
