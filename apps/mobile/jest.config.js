// Was the root `package.json`'s inline `jest` key until the monorepo move.
//
// It has to be run with the cwd inside this workspace, which is why there is
// no root `projects` array: `jest-expo`'s `withTypescriptMapping` resolves
// `tsconfig.json` against `process.cwd()`, and `coverageThreshold`'s path keys
// are resolved the same way. `yarn workspace @brelly/mobile test` does cd here;
// a bare `npx jest` from the repo root does not, and would silently check
// nothing.
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  // Core's suite runs twice, and the two runs answer different questions.
  // Here the `@brelly/platform/*` seams resolve to `src/platform/` — the Expo
  // implementations — so this run is what proves core works on a phone.
  // `yarn test:core` resolves them to platform-free fakes instead. Keeping
  // core in `roots` preserves the pre-monorepo behaviour, where one root
  // config discovered both suites.
  roots: ["<rootDir>", "<rootDir>/../../packages/core"],
  moduleNameMapper: {
    "\\.(css)$": "<rootDir>/__mocks__/styleMock.js",
  },
  // Only this workspace. Coverage cannot cross the `rootDir` boundary —
  // measured: a `../../packages/core/src/**` entry here leaves every core file
  // out of the map even though its modules load and execute, and the threshold
  // group then fails with "Coverage data ... was not found". Core carries its
  // own gate in `packages/core/jest.config.js`.
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/test/**",
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
  },
};
