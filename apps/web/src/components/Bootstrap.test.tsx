import { render } from "@testing-library/react";

import { Bootstrap } from "./Bootstrap";

const useCloudBootstrap = jest.fn(() => false);
jest.mock("@/hooks/useCloudBootstrap", () => ({
  useCloudBootstrap: () => useCloudBootstrap(),
}));

describe("Bootstrap", () => {
  it("runs the bootstrap once and renders nothing", () => {
    // A component rather than a call in the layout, because the layout is a
    // server component. Rendering nothing is what keeps readiness out of the
    // tree: screens read it from the store, so a flag flipping does not
    // re-render everything under the root.
    const { container } = render(<Bootstrap />);

    expect(useCloudBootstrap).toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
