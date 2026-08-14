// Separate from the main `jest` config in package.json on purpose: this
// suite talks to a real (local) Firestore emulator via
// `@firebase/rules-unit-testing`, so it must NOT load jest.setup.js, which
// mocks `@react-native-firebase/firestore` out entirely for every other
// test. Run via `yarn test:emulator`, which starts the emulator first — see
// FIREBASE_MIGRATION.md's testing section and PLAN.md's "Cloud sync" QA
// list for why this is a separate opt-in target rather than part of the
// `yarn test` gate.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/test/emulator/**/*.emulator.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "babel-jest",
      {
        presets: ["@babel/preset-typescript"],
        plugins: ["@babel/plugin-transform-modules-commonjs"],
      },
    ],
  },
};
