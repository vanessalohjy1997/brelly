import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CopyToDateAction } from "./CopyToDateAction";

describe("CopyToDateAction", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15, 10, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens on tomorrow, because that is the copy people make", () => {
    render(<CopyToDateAction onDuplicate={jest.fn()} />);

    expect(
      screen.getByLabelText("Duplicate to another day"),
    ).toHaveValue("2026-09-16");
  });

  it("duplicates onto the day in the field", async () => {
    const onDuplicate = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CopyToDateAction onDuplicate={onDuplicate} />);

    // `fireEvent.change` rather than typing: a `type="date"` fills in by
    // segment in the browser's own locale order, so typing the ISO string lands
    // its digits in whichever segments come first.
    fireEvent.change(screen.getByLabelText("Duplicate to another day"), {
      target: { value: "2026-10-02" },
    });
    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    expect(onDuplicate).toHaveBeenCalledTimes(1);
    // A local `Date`, not a key — the caller formats it for the toast and then
    // turns it into a key itself.
    const [target] = onDuplicate.mock.calls[0] as [Date];
    expect(target.getFullYear()).toBe(2026);
    expect(target.getMonth()).toBe(9);
    expect(target.getDate()).toBe(2);
  });

  it("ignores a half-typed date rather than jumping to one", async () => {
    // A `type="date"` reports "" while the day is still being filled in, and
    // treating that as a change would move the field to something nobody chose.
    const onDuplicate = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CopyToDateAction onDuplicate={onDuplicate} />);

    fireEvent.change(screen.getByLabelText("Duplicate to another day"), {
      target: { value: "" },
    });
    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    const [target] = onDuplicate.mock.calls[0] as [Date];
    expect(target.getDate()).toBe(16);
  });
});
