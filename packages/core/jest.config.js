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
  // Core's own gate, and it stops at what this run can honestly measure.
  // Coverage cannot cross a `rootDir` boundary — the mobile workspace's run
  // executes core's modules but cannot instrument them — so anything core owns
  // whose tests live in `apps/mobile` is excluded here rather than dragging
  // the threshold down to meet it.
  //
  // What that means per exclusion:
  //   - the five sync services exercise the *mobile bindings*; their tests are
  //     in `apps/mobile/src/services/` because they import `expo-notifications`
  //     and `@/store/mmkvStorage`, and they cannot move here.
  //   - `types/` is type-only and `index.ts` is `export *` — neither has
  //     statements worth a threshold.
  // The hole this leaves is real and worth knowing: a new core sync service is
  // gated by no coverage threshold in either workspace. See NOTES.md.
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/test/**",
    "!src/types/**",
    "!src/index.ts",
    "!src/services/accountLinkService.ts",
    "!src/services/cloudListeners.ts",
    "!src/services/itinerarySync.ts",
    "!src/services/routinesSync.ts",
    "!src/services/settingsSync.ts",
  ],
  // Set from observation, not aspiration: the suite measures 98.5/94.4/98.5/99.1
  // over the files above. Higher than the app's 90/85/90/90 because what is
  // left after the exclusions is pure functions behind structural seams.
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
};
