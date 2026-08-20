# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project docs

Read the relevant one before implementing — do not work from memory of them.

- `PLAN.md` — the open task list and the verification gate (`npx tsc --noEmit`,
  `yarn lint`, `yarn test` must all be clean). Tasks only; it links out for
  context.
- `NOTES.md` — the traps to read before writing code here, what is already
  built, and the round-by-round history of why. Move finished work out of
  `PLAN.md` and into here.
- `UX.md` — open UX issues with per-item status. Check here before changing a
  screen, and tick the item when you address it.

Keep all three current as you work: a stale plan gets acted on as if it were
true.

# Branches and commits

Every branch and every commit message starts with the kind of change it makes:

- `feat/`, `feat:` — a feature implementation
- `fix/`, `fix:` — a bug fix
- `chore/`, `chore:` — a refactor or pipeline/workflow change

Name the branch for what it does — `fix/weather-icon-crash`,
`feat/open-meteo-integration` — never a timestamp or a generic label.

Write the commit subject the same way: `feat: weather works outside Singapore
via Open-Meteo`. Say what changed, not that something changed ("feat: more
features" is three commits in this history and none of them are findable).

# Tests

All new features must come with tests.
