// Run with the cwd inside this workspace, the same requirement `apps/mobile`
// has and for the same reason: `coverageThreshold`'s path keys are resolved
// against `process.cwd()`, so a root `projects` array would silently check
// nothing. `yarn workspace @brelly/web test` does cd here.
const nextJest = require("next/jest");

// `next/jest` is not a convenience wrapper — it is what supplies the SWC
// transform that understands JSX, TypeScript and React Server Components, and
// the mocks for CSS/font/image imports that a plain `ts-jest` setup has to
// hand-write. It returns an async config factory, which Jest awaits.
const createJestConfig = nextJest({ dir: __dirname });

module.exports = createJestConfig({
  rootDir: __dirname,
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // `next/jest` passes the tsconfig to SWC but does not turn its `paths` into
  // Jest module mapping, so both aliases are declared here. The second is the
  // web half of the boundary: core imports `@brelly/platform/*`, and this is
  // where those specifiers become this app's own implementations.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@brelly/platform/(.*)$": "<rootDir>/src/platform/$1",
  },
  // Only this workspace — coverage does not cross a `rootDir` boundary, so
  // core is measured by its own gate in `packages/core/jest.config.js`.
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
});
