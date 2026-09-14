import { migrationFlagKey as viaCoreAlias } from "@/utils/migrationFlagKey";
import { migrationFlagKey as viaBarrel } from "@brelly/core";

/**
 * **Temporary, and deliberately so.** Delete this file in the commit that
 * drops the second `@/*` target.
 *
 * `@/*` resolves to two places for the length of the extraction — `./src/*`
 * first, then `./packages/core/src/*`. That is the scaffold that makes the
 * move commits pure `git mv`s: a file can cross into the package without a
 * single import in the app changing, so a rename shows up as a rename and a
 * red test means a real problem rather than a specifier that has not caught up
 * yet.
 *
 * The fallback is also the proof step at the end. Once every app-side import
 * says `@brelly/core`, removing the second target makes anything still
 * reaching into the package fail `tsc` and Jest *by name*. Until then, nothing
 * else in the suite would notice if the second target stopped resolving — the
 * moves would simply stop being pure, one file at a time.
 *
 * This is the one file in `src/` the codemod to `@brelly/core` deliberately
 * skipped: rewriting the specifier here would make it assert that a module
 * equals itself.
 */
describe("the temporary @/ fallback into packages/core", () => {
  it("resolves a specifier that exists only inside the package", () => {
    expect(viaCoreAlias).toBe(viaBarrel);
  });
});
