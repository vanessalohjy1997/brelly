/**
 * The `@brelly/core` barrel — the only specifier either app names.
 *
 * Apps import from here and never from a path inside the package. That is what
 * lets core reorganise its own directories without touching two app trees, and
 * it is the thing `no-restricted-imports` enforces from the other side: core
 * must not reach back into an app, and an app must not reach past this file.
 *
 * It fills up over the course of the extraction; each move commit adds its
 * exports here.
 */
export {
  configureCore,
  getCoreConfig,
  resetCoreConfig,
  type CoreConfig,
  type PlacesConfig,
} from "./config";

export { migrationFlagKey } from "./utils/migrationFlagKey";
