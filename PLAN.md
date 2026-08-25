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
npx tsc --noEmit
yarn lint
yarn test
```

All three must be clean — `yarn lint` runs with `--max-warnings 0`, so a
single warning fails it. See the `implement-feature` skill
(`.claude/skills/implement-feature/SKILL.md`) for the full policy: zero
lint warnings/errors, and a test for every new component and function.

## Tasks

### Platform

- [ ] **Register the widget's App Group in the Apple Developer account.** The
      widget itself is built and `ios.appleTeamId` is set in `app.json` (team
      `PC223N993Y`), so the non-interactive `eas build` no longer stalls on the
      `Apple Team ID:` prompt — see
      [round 29](NOTES.md#round-29--the-widget-the-one-thing-appjson-couldnt-reach).
      The last step before the native build signs is enabling the App Group
      `group.com.sg.brelly.app` on both the `com.sg.brelly.app` and
      `com.sg.brelly.app.widget` App IDs in the portal.

### Itinerary intelligence

- [ ] **Swipe a stop to mute as well as delete.** The card's left-swipe reveals
      only Delete; muting a stop is view-only from the list (`ItineraryCard`
      draws the bell-slash but changing it needs the full edit form). Add a
      second swipe action — Mute/Unmute — beside Delete. `ReanimatedSwipeable`'s
      `renderRightActions` already passes `swipeableMethods` to close the row
      after a mute tap. One-off stops toggle instantly with an undo toast,
      through a new mute seam alongside `useDeleteSlotWithUndo` (`updateSlot` +
      `stripNotificationHandles` and `cancelNotification` on mute;
      `useRainNotificationScheduler` to re-schedule on unmute). Routine stops
      can't take a silent per-day flag — Rule 4 of `planRoutineMaterialization`
      compares `notificationsMuted` and replaces any routine slot that disagrees
      with its rule, so the mute would vanish on the next top-up — so muting or
      deleting one raises the same `askEditScope` day/series prompt the edit
      form (`plan/[id].tsx`) already uses: series edits the rule via
      `updateRoutine`/`deleteRoutine` + `materializeRoutines`, day detaches the
      slot (`addException` + `routineId: undefined`). Fold the routine-scope
      prompt into `useDeleteSlotWithUndo` so every delete path shares one seam —
      which changes swipe-delete on a routine from today's silent this-day to a
      prompt. Gate Mute on `!past` (History has no future alert to mute); add a
      `hapticToggle` and a `toggle-mute` accessibility action. This is the
      quick-mute item from the UX review (`UX.md`, Today screen), promoted here
      because it also reworks the delete seam and routine scope, not just a
      screen.
