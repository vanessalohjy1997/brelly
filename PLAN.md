# Brelly implementation plan

Brelly shows weather (NEA's `data.gov.sg` in Singapore, Open-Meteo elsewhere —
see [round 19](NOTES.md#round-19--weather-works-outside-singapore)) for
user-planned itinerary stops (via Google Places). This file is the task list
only.

## Before you start

- `NOTES.md` — [the traps](NOTES.md#read-this-before-writing-code-here) (tests,
  the zustand store, date keys, NEA response shapes, Expo config plugins,
  Firestore/cloud sync) and [what is already built](NOTES.md#built-so-far). Read
  the traps before touching any of those areas; read the round history for why
  something is the way it is.
- `UX.md` — open UX issues with per-item status. Check before changing a screen,
  and tick the item when you address it.

## Verification gate

Run before checking off any item below, and after every change:

```
yarn verify:fast
```

Run it **from the repo root**. That is `yarn typecheck && yarn lint && yarn
test`, which fan out over the workspaces — `yarn typecheck` compiles each app's
project, and `yarn test` runs `apps/mobile`'s suite and then `packages/core`'s
own, each with the cwd inside its workspace, which is load-bearing (see the
Jest trap in `NOTES.md`). All three must be clean — `yarn lint` is
`eslint . --max-warnings 0` and covers the whole repo, not just `apps/mobile`,
so a single warning anywhere fails it. `yarn verify` is the same gate
with coverage, as CI runs it. See the `implement-feature` skill
(`.claude/skills/implement-feature/SKILL.md`) for the full policy: zero
lint warnings/errors, and a test for every new component and function.

## Tasks

### Brelly on the web — a Next.js app in a monorepo

The whole design, with the evidence behind each claim, is in [`WEB.md`](WEB.md).
Read the phase there before starting it; these are the headings only.

- [x] **Phase 0 — de-risk the harness.** Three commits, no structure change.
      Written up in [round 36](NOTES.md#round-36--phase-0-of-the-web-migration-de-risking-the-harness).
- [x] **Phase 1 — extract `packages/core`.** 15 commits plus a bug-fix commit.
      Written up in [round 37](NOTES.md#round-37--phase-1-of-the-web-migration-packagescore).
      Measured, and it is **not** fingerprint-neutral: `contents:packageJson:scripts`
      moved (`test:core` is new), nothing else hashed did.
- [x] **Phase 2 — the physical move** to `apps/mobile`. Three commits;
      the fourth is the native build below, which is not a commit. Written up
      in [round 38](NOTES.md#round-38--phase-2-of-the-web-migration-the-physical-move).
      The fingerprint moved, as predicted and for the predicted reason.
- [ ] **Cut `production` and `preview` iOS builds from the post-Phase-2 tree.**
      This is Phase 2's last step and it gates Phase 3's OTA story, not just
      tidiness: the fingerprint changed with the move, so **no OTA update can
      reach anyone** until both profiles have a finished build carrying the new
      hash. Run the *iOS Release* workflow once per profile. `ota-update.yml`
      already refuses to publish before then, which is the failure being made
      visible rather than one to work around.
- [ ] **Phase 3 — `apps/web`.** Purely additive, cannot break mobile. See
      [WEB.md](WEB.md#phase-3--appsweb-purely-additive-cannot-break-mobile).
- [ ] **Phase 4 — deploy.** The `/api/places` abuse control is a gate here, not
      a follow-up. See [WEB.md](WEB.md#phase-4--deploy).

OTA is closed until the two builds above finish. The tag
`ota-baseline-pre-monorepo` still makes an emergency hotfix a checkout.

Finished work moves into `NOTES.md` — the round history there says why each
thing is the way it is. New work is added back here as a task, not as a
finished description.
