/**
 * The `@brelly/core` barrel.
 *
 * Empty of real exports until the move commits fill it in. It exists from the
 * first commit of the extraction so that the package has a file, a test, and
 * therefore its own coverage group — `jest.coverageThreshold` only splits a
 * path out of the global group when at least one file matches it, and a group
 * that appears for the first time halfway through the extraction would hide
 * whatever was uncovered before it.
 */
export const CORE_PACKAGE_NAME = "@brelly/core";
