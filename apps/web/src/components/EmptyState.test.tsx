import { render, screen } from "@testing-library/react";

import { EmptyState } from "./EmptyState";
import { Icons } from "./icons";

describe("EmptyState", () => {
  it("makes its title a second-level heading under the page's own", () => {
    render(<EmptyState title="Nothing planned" body="Add a plan to see it here." />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Nothing planned" }),
    ).toBeInTheDocument();
  });

  it("takes an icon only when the caller wants an anchor", () => {
    // With a forecast card above it the icon is repetition; without one the
    // empty state needs its own.
    const { rerender } = render(<EmptyState title="No matches" body="Nothing here." />);
    expect(screen.queryByTestId(/^icon-/)).not.toBeInTheDocument();

    rerender(
      <EmptyState icon={Icons.search} title="No matches" body="Nothing here." />,
    );
    expect(screen.getByTestId("icon-search")).toBeInTheDocument();
  });

  it("renders the action it is given", () => {
    render(
      <EmptyState
        title="Nothing planned"
        body="Add a plan."
        action={<button>+ Add a plan</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "+ Add a plan" })).toBeInTheDocument();
  });
});
