import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("says what is being waited for, not just that something is", () => {
    render(<Skeleton label="Loading your plans…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your plans…");
  });

  it("swaps the spinner for the failure and a way out", async () => {
    // Otherwise the reader is left staring at "Loading…" with nothing to do —
    // which is what happens when a listener never answers and nothing says so.
    const onRetry = jest.fn();
    render(<Skeleton error="We couldn't load your plans." onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load your plans.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows the failure without a retry when there is nothing to retry", () => {
    render(<Skeleton error="Permission denied." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
