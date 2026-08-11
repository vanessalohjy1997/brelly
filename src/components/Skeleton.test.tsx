import { render } from "@testing-library/react-native";

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
});
