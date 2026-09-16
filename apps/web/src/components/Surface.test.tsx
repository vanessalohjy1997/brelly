import { render, screen } from "@testing-library/react";

import { Surface } from "./Surface";

describe("Surface", () => {
  it("defaults to a card: the element surface, at the card radius", () => {
    render(<Surface>content</Surface>);
    const node = screen.getByText("content");

    expect(node).toHaveClass("bg-background-element", "rounded-card");
  });

  it("takes the control radius where the thing is pressed rather than read", () => {
    render(<Surface radius="control">content</Surface>);
    expect(screen.getByText("content")).toHaveClass("rounded-control");
  });

  it("can be the element the document needs rather than always a div", () => {
    render(<Surface as="section">content</Surface>);
    expect(screen.getByText("content").tagName).toBe("SECTION");
  });
});
