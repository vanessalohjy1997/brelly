import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import * as barrel from "./index";

const here = __dirname;

function modulesUnder(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return modulesUnder(join(dir, entry.name), `${prefix}${entry.name}/`);
    }
    if (!entry.name.endsWith(".ts")) return [];
    if (entry.name.endsWith(".test.ts")) return [];
    if (prefix === "" && entry.name === "index.ts") return [];
    return [`${prefix}${entry.name.slice(0, -3)}`];
  });
}

describe("the @brelly/core barrel", () => {
  it("resolves under the name the apps import, through the workspace symlink", () => {
    // Not a tautology: the apps say `@brelly/core`, which reaches this file
    // through `node_modules/@brelly/core` — a symlink Yarn 1 creates from the
    // `workspaces` key. Importing it by relative path here and by package name
    // there is the only way a broken symlink fails as a test rather than as a
    // red `tsc` in whichever app happens to build first.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("@brelly/core")).toEqual(barrel);
  });

  it("re-exports every module in the package", () => {
    // A module missing from here is not a small omission — it is the thing
    // that makes someone reach past the barrel, and once one import does
    // that, core cannot move its own files again. Checked against the
    // directory rather than a list, because a list is the same maintenance
    // problem one step removed.
    const exported = new Set(
      [...readFileSync(join(here, "index.ts"), "utf8").matchAll(
        /export \* from "\.\/([^"]+)";/g,
      )].map((m) => m[1]),
    );

    expect([...modulesUnder(here)].filter((m) => !exported.has(m))).toEqual([]);
  });

  it("carries names from every layer, not just the ones a smoke test would hit", () => {
    expect(typeof barrel.configureCore).toBe("function");
    expect(typeof barrel.getRegionFromCoordinates).toBe("function");
    expect(typeof barrel.useItineraryStore).toBe("function");
    expect(typeof barrel.toDateKey).toBe("function");
    expect(typeof barrel.searchPlaces).toBe("function");
  });
});
