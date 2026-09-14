/**
 * Core's own suite, run without an app around it.
 *
 * The root `package.json` still runs everything in one pass today, and this
 * config is not a duplicate of it — it answers a different question. Under the
 * root config, `@brelly/platform/*` resolves to `src/platform/`, which is the
 * *Expo* implementation: core passing there proves core works on a phone.
 * Here the seams resolve to platform-free fakes, so core passing proves it
 * imports nothing secretly Expo-shaped — the question Phase 3 would otherwise
 * answer late, by way of a Next build failing on `react-native`.
 *
 * `jest-expo/node` rather than the default preset: there is no React Native
 * renderer in here to need, and there should not be.
 *
 * Run it with `yarn test:core`.
 */
const path = require("path");

const platform = path.join(__dirname, "src/test/platform");

module.exports = {
  preset: "jest-expo/node",
  rootDir: __dirname,
  testEnvironment: "node",
  // `jest-expo/node` drops the babel `presets` the default preset supplies,
  // and this repo has no `babel.config.js` for babel to fall back to — every
  // suite fails on `Cannot use import statement outside a module` without
  // this. `root` points at the workspace root so babel resolves the preset
  // from the same `node_modules` the app does.
  transform: {
    "\\.[jt]sx?$": [
      "babel-jest",
      {
        root: path.join(__dirname, "..", ".."),
        presets: [require.resolve("expo/internal/babel-preset.js")],
        caller: { name: "metro", bundler: "metro", platform: "web", isServer: true },
      },
    ],
  },
  moduleNameMapper: {
    "^@brelly/platform/(.*)$": `${platform}/$1`,
  },
  setupFilesAfterEnv: [path.join(__dirname, "jest.setup.js")],
  testPathIgnorePatterns: ["/node_modules/"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/test/**",
  ],
};
