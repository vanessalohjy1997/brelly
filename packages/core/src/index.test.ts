import { CORE_PACKAGE_NAME } from "./index";

describe("@brelly/core", () => {
  it("resolves from the workspace symlink under the name the apps import", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require(CORE_PACKAGE_NAME).CORE_PACKAGE_NAME).toBe(CORE_PACKAGE_NAME);
  });
});
