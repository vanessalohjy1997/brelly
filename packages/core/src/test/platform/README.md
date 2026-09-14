# `test/platform/` — the seams, for core's own suite

`packages/core` compiles inside an app, never on its own, so `tsc` proves that
*that app's* implementations satisfy what core imports. Its **tests** need
something else: a set of implementations that belong to no platform, so the
suite can run without an Expo app or a Next app around it.

That is what these are, and running them is a claim worth making. Core passing
here means nothing it imports is secretly Expo-shaped — which is the question
Phase 3 would otherwise answer late, by way of a Next build failing on
`react-native`.

`packages/core/jest.config.js` maps `@brelly/platform/*` here.
