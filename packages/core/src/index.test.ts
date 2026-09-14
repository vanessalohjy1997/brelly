import * as barrel from "./index";

describe("the @brelly/core barrel", () => {
  it("resolves under the name the apps import, through the workspace symlink", () => {
    // Not a tautology: the apps say `@brelly/core`, which reaches this file
    // through `node_modules/@brelly/core` — a symlink Yarn 1 creates from the
    // `workspaces` key. Importing it by relative path here and by package name
    // there is the only way a broken symlink shows up as a test failure rather
    // than as a red `tsc` in whichever app happens to build first.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("@brelly/core")).toEqual(barrel);
  });

  it("exports only through the barrel, never a path inside the package", () => {
    expect(Object.keys(barrel).sort()).toEqual([
      "configureCore",
      "getCoreConfig",
      "migrationFlagKey",
      "resetCoreConfig",
    ]);
  });
});
