import "@testing-library/jest-dom";

// Core refuses to run unconfigured, so this suite is an entry point like any
// other and configures it the way `src/app/providers.tsx` does. Reached by its
// own path rather than through `@brelly/core`: the barrel is `export *` over
// the whole package, so requiring it here would instantiate every core module
// before any test file's `jest.mock` factory runs, and a module already in the
// registry keeps the real bindings it closed over.
//
// The `proxy` arm carries no key by construction — that is the point of the
// union — so unlike the mobile suite there is no fixture key here to leak.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../../packages/core/src/config").configureCore({
  places: { mode: "proxy", placesPath: "/api/places", geocodePath: "/api/places/geocode" },
});
