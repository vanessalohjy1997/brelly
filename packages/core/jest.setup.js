// Core refuses to run unconfigured, so its own suite is an entry point like
// any other — the same call `src/app/_layout.tsx` and the app's `jest.setup.js`
// make. The key is a fixture: every test that reaches `geocoding.ts` mocks
// `fetch`, and one that did not would be making a billed request from CI.
require("./src/config").configureCore({
  places: { mode: "direct", apiKey: "test-places-key" },
});
