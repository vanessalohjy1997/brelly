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
| New code comes with tests | the 90% coverage threshold in `package.json`, checked by `yarn test:coverage` |
| The project docs are in context when you work | `.claude/hooks/session-context.sh`, a SessionStart hook — it injects them rather than asking that they be read |
| The v57 docs are named when writing code | `.claude/hooks/doc-gate.sh`, a PreToolUse hook on `Edit`/`Write` |

The git hooks activate through `yarn install` (the `prepare` script points
`core.hooksPath` at `.githooks`). CI does not trust them — it re-runs the same
checks, because `--no-verify` exists.

The last two are the soft ones, and the difference matters. The first four fail
a build. The SessionStart hook cannot fail anything; it just makes the docs
present, which removes the reason the rule existed. The `doc-gate` reminder is
the one thing left that still relies on being read: a versioned docs site is not
a local file, so there is nothing to inject.

# Tests

Test what a new feature actually promises. The coverage gate stops uncovered
code from merging; it cannot tell you whether the assertions are worth
anything.
