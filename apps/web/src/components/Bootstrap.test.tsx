import { render } from "@testing-library/react";

import { Bootstrap } from "./Bootstrap";

const useCloudBootstrap = jest.fn(() => false);
const useRoutineSync = jest.fn();
jest.mock("@/hooks/useCloudBootstrap", () => ({
  useCloudBootstrap: () => useCloudBootstrap(),
}));
jest.mock("@/hooks/useRoutineMaterializer", () => ({
  useRoutineSync: () => useRoutineSync(),
}));

describe("Bootstrap", () => {
  it("runs both root jobs and renders nothing", () => {
    // A component rather than a call in the layout, because the layout is a
    // server component. Rendering nothing is what keeps readiness out of the
    // tree: screens read it from the store, so a flag flipping does not
    // re-render everything under the root.
    const { container } = render(<Bootstrap />);

    expect(useCloudBootstrap).toHaveBeenCalled();
    // The routine top-up runs here too — skipping it would leave a routine
    // deleted from a browser with a fortnight of stops still standing.
    expect(useRoutineSync).toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
