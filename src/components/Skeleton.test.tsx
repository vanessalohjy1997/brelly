import { fireEvent, render } from "@testing-library/react-native";

import { Skeleton } from "@/components/Skeleton";

describe("Skeleton", () => {
  it("shows a default loading label", async () => {
    const view = await render(<Skeleton />);

    expect(view.getByText("Loading…")).toBeTruthy();
  });

  it("shows a custom label", async () => {
    const view = await render(<Skeleton label="Loading your plans…" />);

    expect(view.getByText("Loading your plans…")).toBeTruthy();
  });

  it("shows the error instead of the label when one is given", async () => {
    const view = await render(
      <Skeleton label="Loading your plans…" error="auth/unknown" />,
    );

    expect(view.getByText("auth/unknown")).toBeTruthy();
    expect(view.queryByText("Loading your plans…")).toBeNull();
  });

  it("shows a retry button when both an error and onRetry are given", async () => {
    const onRetry = jest.fn();
    const view = await render(
      <Skeleton error="auth/unknown" onRetry={onRetry} />,
    );

    await fireEvent.press(view.getByText("Try again"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows no retry button when an error has no onRetry", async () => {
    const view = await render(<Skeleton error="auth/unknown" />);

    expect(view.queryByText("Try again")).toBeNull();
  });
});
