## Summary

<!-- One or two sentences: what this PR does, not that it does something. -->

## Description

<!-- The problem or task this closes. Link the PLAN.md / UX.md item if there is one. -->

## Verification gate

All three must be clean (see `PLAN.md`):

- [ ] `npx tsc --noEmit`
- [ ] `yarn lint` (runs with `--max-warnings 0` — one warning fails it)
- [ ] `yarn test`

## Checklist

- [ ] Branch and commit subjects start with `feat:` / `fix:` / `chore:` and say what changed
- [ ] New features and functions come with tests
- [ ] UI values come from the design tokens in `src/constants/theme.ts` (no new literals)
- [ ] `PLAN.md`, `NOTES.md`, `UX.md` updated if this changes what they describe

## Screenshots / recordings

<!-- For any UI change. Delete this section if there is none. -->
