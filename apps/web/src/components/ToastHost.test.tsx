import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { showToast, useToastStore } from "@brelly/core";

import { ToastHost } from "./ToastHost";

function raise(...args: Parameters<typeof showToast>) {
  act(() => showToast(...args));
}

beforeEach(() => {
  jest.useFakeTimers();
  useToastStore.setState({ toast: null, modalHosts: [] });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("ToastHost", () => {
  it("renders nothing until something is raised", () => {
    render(<ToastHost />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces politely rather than interrupting", () => {
    // `status`, not `alert`: a confirmation that a plan was saved is not worth
    // cutting a screen reader off mid-sentence for, and neither is a failure
    // the user is about to see anyway.
    render(<ToastHost />);
    raise("Plan saved");

    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(toast).toHaveTextContent("Plan saved");
  });

  it("clears itself after the ordinary lifetime", () => {
    render(<ToastHost />);
    raise("Weather updated");

    act(() => jest.advanceTimersByTime(3200));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("gives a toast carrying an action longer, because it is the way back", () => {
    render(<ToastHost />);
    raise("Plan deleted", "success", { label: "Undo", onPress: jest.fn() });

    act(() => jest.advanceTimersByTime(3200));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(6000 - 3200));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("runs the action and dismisses, so no handler has to", async () => {
    const onPress = jest.fn();
    render(<ToastHost />);
    raise("Plan deleted", "success", { label: "Undo", onPress });

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .click(screen.getByRole("button", { name: "Undo" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a dismiss button when there is no action to press", async () => {
    render(<ToastHost />);
    raise("Couldn't reach the weather service", "error");

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("carries the variant in the glyph as well as the outline", () => {
    // Green and red is the colour-vision-unsafe axis. It is acceptable here
    // because only one toast is ever on screen, and because the glyph and the
    // words both say it without the hue.
    const { rerender } = render(<ToastHost />);
    raise("Saved");
    expect(screen.getByTestId("icon-check_circle")).toBeInTheDocument();

    rerender(<ToastHost />);
    raise("Couldn't save", "error");
    expect(screen.getByTestId("icon-warning")).toBeInTheDocument();
  });

  it("survives the route that raised it", () => {
    // The toast lives in the store rather than in the host, so unmounting and
    // remounting the host — what a navigation does — leaves it on screen.
    const { unmount } = render(<ToastHost />);
    raise("Plan saved");
    unmount();

    render(<ToastHost />);
    expect(screen.getByRole("status")).toHaveTextContent("Plan saved");
  });
});
