import { hapticDelete, hapticError, hapticSuccess, hapticToggle } from "./haptics";

/**
 * There is nothing to assert about a no-op except that it *is* one — which is
 * the point. The Vibration API is deliberately not used here (unimplemented on
 * desktop and on iOS Safari, and a single buzz where the phone plays four
 * distinct patterns), so the contract these four keep is "callable, silent,
 * synchronous". A future implementation that returned a promise would break
 * the toast store, which calls them without awaiting.
 */
describe("web haptics", () => {
  it.each([
    ["hapticDelete", hapticDelete],
    ["hapticError", hapticError],
    ["hapticSuccess", hapticSuccess],
    ["hapticToggle", hapticToggle],
  ])("%s is a silent synchronous no-op", (_name, fn) => {
    expect(fn()).toBeUndefined();
  });
});
