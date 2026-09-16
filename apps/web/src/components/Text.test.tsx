import { render, screen } from "@testing-library/react";

import { Text } from "./Text";

describe("Text", () => {
  it("renders a span at the default variant", () => {
    render(<Text>Today</Text>);
    const node = screen.getByText("Today");

    expect(node.tagName).toBe("SPAN");
    expect(node).toHaveClass("text-default", "text-text");
  });

  it("takes the element separately from the size, so a heading can be either", () => {
    // `title` is the h1 on a page and an h2 inside a dialog, at the same size
    // in both — which is why the element is a prop rather than derived from
    // the variant.
    const { rerender } = render(
      <Text variant="title" as="h1">
        Plans
      </Text>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("text-title");

    rerender(
      <Text variant="title" as="h2">
        Plans
      </Text>,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("text-title");
  });

  it("gives linkPrimary the theme's primary rather than a colour of its own", () => {
    render(<Text variant="linkPrimary">Routines</Text>);
    expect(screen.getByText("Routines")).toHaveClass("text-primary");
  });

  it("lets an explicit colour override the variant's default", () => {
    render(
      <Text variant="linkPrimary" color="danger">
        Sign out
      </Text>,
    );
    expect(screen.getByText("Sign out")).toHaveClass("text-danger");
  });

  it("uppercases the two small-caps variants by variant, not by call site", () => {
    render(
      <>
        <Text variant="eyebrow">Right now</Text>
        <Text variant="fieldLabel">Location</Text>
      </>,
    );
    expect(screen.getByText("Right now")).toHaveClass("uppercase");
    expect(screen.getByText("Location")).toHaveClass("uppercase");
  });

  it("keeps caller classes alongside the variant's", () => {
    render(<Text className="text-center">Nothing planned</Text>);
    expect(screen.getByText("Nothing planned")).toHaveClass(
      "text-default",
      "text-center",
    );
  });
});

describe("Text colour inheritance", () => {
  it("can take the colour of whatever encloses it", () => {
    // A selected nav item colours itself and its label follows, rather than
    // both naming the same token and drifting apart later.
    render(<Text color="inherit">Today</Text>);
    expect(screen.getByText("Today")).toHaveClass("text-inherit");
  });
});
