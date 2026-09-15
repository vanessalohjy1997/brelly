# Expo HAS CHANGED

This project is on Expo v57, and v57 is not the SDK you remember. The versioned
docs are at https://docs.expo.dev/versions/v57.0.0/. An answer from an older SDK
will often typecheck and still be wrong, so when an API matters, look it up
there rather than recalling it.

# Project docs

- `PLAN.md` — the open task list. Tasks only; it links out for context.
- `NOTES.md` — the traps to read before writing code here, what is already
  built, and the round-by-round history of why.
- `UX.md` — open UX issues with per-item status.

You do not have to remember to read these. `.claude/hooks/session-context.sh`
injects them at the start of every session: `PLAN.md` whole, the "read this
before writing code here" section of `NOTES.md`, and the still-unticked items
from `UX.md`. What it leaves out — the round history in `NOTES.md`, ticked UX
items — is archive; open those files directly when you want the why behind a
past decision.

A stale plan gets acted on as if it were true, and now it gets injected as if it
were true too. Move finished work from `PLAN.md` into `NOTES.md` and tick the
`UX.md` item you just addressed.

# Where things are

The repo is a Yarn workspace, and the root is no longer the Expo app.

```
apps/mobile/     the Expo app — src/, assets/, plugins/, targets/, app.json,
                 eas.json, its own tsconfig.json and jest.config.js
apps/web/        the Next.js app (from Phase 3)
packages/core/   the logic both apps need, platform-free
tests/           Firestore rules, against the emulator
```

The root keeps the workspace manifest, `eslint.config.js`, the project docs,
`firestore.rules` and `.githooks/`. **There is no root `tsconfig.json`** — a
`files: []` stub would let `tsc --noEmit` succeed while checking nothing, so
each app owns its project and `yarn typecheck` fans out over them.

Run repo-wide scripts from the root (`yarn verify:fast`, `yarn lint`,
`yarn test`). Run the app's own scripts with
`yarn workspace @brelly/mobile <script>`, which cds into the workspace — and
that cd is load-bearing, not cosmetic. See the Jest trap in `NOTES.md`.

# The `packages/core` boundary

`packages/core` holds the logic both apps need. Two rules govern what crosses:

**Alias for behaviour, inject for values.** Where the two platforms do the same
thing by different means, core imports a bare specifier no package provides —
`@brelly/platform/firestore`, `/firebase`, `/auth`, `/storage`, `/dialogs`,
`/haptics`, `/notifications`, `/appSettings` — and each app resolves it in its
own `tsconfig.json` `paths`. Where they merely need a different *value*, no
alias helps: `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` are literal text substitutions
each bundler performs on its own files. Those go through `configureCore()`.

**Apps import `@brelly/core`, never a path inside it.** Both directions are
lint-enforced (`no-restricted-imports` in `eslint.config.js`), so you will be
told rather than having to remember. The two exceptions are deliberate:
`@brelly/core/test` is the fakes, a second entry point kept out of the barrel so
test doubles never reach a bundle; and `jest.mock("@brelly/core/services/x")`
names a *module to replace*, which is not an import and has to be the real
module — Jest keys its registry by resolved path, and that is what intercepts
one core module calling another. Mocking the barrel does not.

Core is never compiled on its own; it is compiled inside each app's project, so
a platform implementation that drifts from what core imports fails that app's
`tsc --noEmit`. `yarn test:core` is the other half: it runs core's suite with
the seams resolved to platform-free fakes, which is what catches core importing
something secretly Expo-shaped before a Next build does.

# Branches and commits

Name the branch for what it does — `fix/weather-icon-crash`,
`feat/open-meteo-integration` — never a timestamp or a generic label.

Write the commit subject the same way: `feat: weather works outside Singapore
via Open-Meteo`. Say what changed, not that something changed ("feat: more
features" is three commits in this history and none of them are findable).

# Enforced, not written here

These are machine-checked. They are listed so you know they exist, not so you
can follow them from memory — nothing lands if they fail.

| Rule | Enforced by |
| --- | --- |
| Commit subject starts with `feat:` / `fix:` / `chore:` | `.githooks/commit-msg`, and the `conventions` job in `.github/workflows/ci.yml` |
| Branch starts with `feat/` / `fix/` / `chore/` | `.githooks/pre-push`, and the same CI job |
| `tsc --noEmit`, `yarn lint`, `yarn test:coverage` all clean | the `verify` job in `.github/workflows/ci.yml`; run it locally with `yarn verify` |
| New code comes with tests | two coverage thresholds — 90/85/90/90 in `apps/mobile/jest.config.js`, 95/90/95/95 in `packages/core/jest.config.js` — checked by `yarn test:coverage` |
| No workspace grows its own lockfile | the `No stray workspace lockfiles` step in `ci.yml`; one inside `apps/*` breaks the root `--frozen-lockfile` quietly and permanently |
| The project docs are in context when you work | `.claude/hooks/session-context.sh`, a SessionStart hook — it injects them rather than asking that they be read |
| The v57 docs are named when writing code | `.claude/hooks/doc-gate.sh`, a PreToolUse hook on `Edit`/`Write` |

The git hooks activate through `yarn install` (the `prepare` script points
`core.hooksPath` at `.githooks`). CI does not trust them — it re-runs the same
checks, because `--no-verify` exists.

The first two rules are ours, not Dependabot's: the `conventions` job skips a
PR opened by `dependabot[bot]`, whose `dependabot/` branch prefix is fixed and
whose subjects are scoped (`chore(deps): bump ...`). Without that skip every
dependency bump sat red on naming it cannot change.

The last two are the soft ones, and the difference matters. The first four fail
a build. The SessionStart hook cannot fail anything; it just makes the docs
present, which removes the reason the rule existed. The `doc-gate` reminder is
the one thing left that still relies on being read: a versioned docs site is not
a local file, so there is nothing to inject.

# Tests

Test what a new feature actually promises. The coverage gate stops uncovered
code from merging; it cannot tell you whether the assertions are worth
anything.
