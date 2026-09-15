import { render, screen } from "@testing-library/react";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("makes the title the page's h1", () => {
    // There is no heading hierarchy to port — nothing in the phone's `src/app`
    // uses `accessibilityRole="header"` — so it is invented here, and this is
    // the top of it.
    render(<PageHeader title="Today" />);
    expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  });

  it("carries a subtitle without making it a heading", () => {
    render(<PageHeader title="Today" subtitle="Monday, 15 September" />);

    expect(screen.getByText("Monday, 15 September")).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("holds the header token as a minimum, not as a fixed height", () => {
    // Fixed on the phone so switching tabs does not shift the content below.
    // A browser window can be narrow enough that a title and its actions wrap,
    // and a fixed height there clips them.
    render(<PageHeader title="Plans" />);
    expect(screen.getByRole("banner")).toHaveClass(
      "min-h-[var(--brelly-header-height)]",
      "flex-wrap",
    );
  });

  it("renders the actions it is given", () => {
    render(<PageHeader title="Plans" actions={<button>+ Add</button>} />);
    expect(screen.getByRole("button", { name: "+ Add" })).toBeInTheDocument();
  });
});
