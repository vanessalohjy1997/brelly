---
name: implement-feature
description: Use whenever implementing, adding, or extending a feature, screen, component, hook, or function in this repo (brelly). Defines this project's definition of done — zero ESLint warnings/errors and a test for every new component and function — before the work can be considered complete.
---

# Implement feature

This repo requires two things of every feature change, no exceptions:

1. **`yarn lint` passes with zero warnings and zero errors.** The `lint`
   script runs with `--max-warnings 0`, so a single warning fails the
   command. Fix the warning — don't relax that flag, add `--quiet`, or
   suppress the rule inline to make it pass instead.
2. **Every new component and function has a test.** This applies to anything
   newly *added* by the change, not everything touched. No new component or
   exported function ships without one.

## Workflow

1. Implement the feature.
2. For each new exported function/hook and each new component, write a test:
   - Co-locate as `<name>.test.ts` / `<name>.test.tsx` next to the file it
     tests — see `src/services/weather.test.ts` and
     `src/constants/neaRegions.test.ts` for the existing pattern. Fixtures
     should mirror real data (actual API response shapes, real coordinates),
     not a convenient guess at the shape — a prior pass in this repo shipped
     three separate NEA API parsing bugs that no test caught because the
     types were never checked against a live response.
   - Test behavior — given these inputs, this output or rendered result —
     not internal implementation details.
   - Skip only what genuinely can't be unit-tested (e.g. native-module glue);
     don't skip because it's inconvenient.
3. Run the full verification gate and fix anything it flags:
   ```
   npx tsc --noEmit
   yarn lint
   yarn test
   ```
   All three must be clean before the feature is done.
4. If the change corresponds to a tracked item in `PLAN.md`, update its
   checklist.

Do not report a feature as complete if any of these three commands fail, or
if new components/functions shipped without tests.
