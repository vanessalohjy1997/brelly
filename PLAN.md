# Brelly implementation plan

Brelly shows Singapore weather (via `data.gov.sg` NEA APIs) for user-planned
itinerary stops (via Google Places). This file is the task list only.

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

- [ ] **Widget / lock-screen glance of the next slot's weather.** The only item
      from the original backlog still open, and the only one that can't be
      built from this repo alone: it needs a native WidgetKit extension target
      (and an Android `AppWidgetProvider`), a new Xcode target with its own
      bundle id and entitlement, and an App Group to share the next slot and
      its forecast across the process boundary — none of which is reachable
      through `app.json` or the verification gate, since a widget renders in a
      separate process that Jest can't mount. Design work first, not code:
      decide what one glance says (next stop + verdict pill is the obvious
      answer) and what writes it — most likely the existing foreground resync
      in `useNotificationSync`, since it already re-reads every upcoming slot's
      forecast and is the only thing that runs on a schedule.
- [x] **Onboarding permission priming.** Location and notification prompts fire
      cold, mid-task, with no explanation of what they buy — and a denied
      notification prompt silently disables the app's main feature.
- [x] **Accessibility pass.** Swipe-to-delete is gesture-only with no
      accessibility action, and no screen has been checked against Dynamic
      Type. (Drag-to-reorder was the other half of this and is gone — see
      [round 7](NOTES.md#round-7--one-order-and-feedback-on-every-save).)
- [x] **Haptics** on delete and on a failed save, to give the toast a
      non-visual counterpart.

### Itinerary intelligence

Each names the seam it hangs off — none of them need new architecture.

- [x] **Gap and overlap warnings.** Every slot stores `latitude`/`longitude`,
      `startTime` and `endTime`, so a pure `detectScheduleConflicts(slots)` —
      overlapping times, or a straight-line distance that isn't plausible in the
      gap between them — is exactly the plain-data-in/plain-data-out util shape
      this repo can actually test.
- [x] **"Move it later" suggestion.** `getUpcomingForecast` already returns the
      24hr forecast's periods; when a slot's period is wet and an adjacent one
      isn't, offering the dry window turns the app from reporting to advising.
      Reuses `retargetSlotDate`'s existing edit path.
- [x] **Notes and an auto-seeded packing list per slot** (umbrella, sunscreen),
      derived from the same forecast text `shouldNotifyForRain` already reads.
- [x] **Week view on Plans.** The 4-day outlook is island-wide and already
      fetched — a date strip showing each upcoming day's forecast alongside its
      plan count is mostly presentation over `splitPlansByTime`.
- [x] **Routines have no home of their own.** A rule is only reachable through
      one of the days it produced: open any stop and Save or Delete asks about
      scope. That is enough to edit and end a routine, and deliberately so for
      now — but there is no way to see *which* routines exist, and a rule whose
      every remaining day was deleted one at a time is unreachable while still
      filling the horizon back in. A list over `routineStore.routines` reusing
      `describeRoutine` is the whole screen.

### Data lifecycle

- [x] **Store schema versioning.** Neither `persist` config passes `version` or
      `migrate`. Not a prerequisite for adding *optional* fields — see
      [why it is still open](NOTES.md#store-schema-versioning--why-it-is-still-open)
      — but required by the first field that changes or removes an existing one.
- [x] **Export/import a JSON backup.** MMKV is device-local with no backup path;
      losing the app loses the history that the Past plans screen deliberately
      preserves.
- [x] **Prune or paginate the archive.** `src/app/past.tsx` renders every
      finished stop ever recorded, which is fine at a few dozen and not at a
      few thousand. `splitPlansByTime` walks all plans on every render of three
      screens, so the cheap first move is a cutoff (or a "clear before this
      date") rather than virtualisation. Routines make this arrive sooner
      rather than change the answer: one weekday routine adds ~260 archived
      stops a year on its own.
- [x] **Watch the iOS 64-notification cap.** One alert per *rainy upcoming*
      stop, and routines multiply upcoming stops. NEA forecasts only ~4 days
      out, so most of a 14-day horizon schedules nothing and the real number
      stays small — but `countScheduledNotifications` already exists in
      Settings, and nothing yet fails loudly if the OS starts dropping
      schedules.

### Cloud sync — manual QA

Itinerary, routines and settings now sync through Firestore instead of MMKV
(anonymous auth, account linking, multi-device merge — see
[NOTES.md round 16](NOTES.md#round-16--off-mmkv-onto-firestore)). None of the
items below are reachable through `tsc`/`lint`/`test`; each needs a real
device or simulator, and the last needs the Firebase Local Emulator Suite
running. Tick as run, not as coded — the code for all of these has shipped.

- [ ] **Offline add/edit/delete.** Airplane mode, add/edit/delete a plan and a
      routine, confirm the UI reflects it immediately; reconnect and confirm
      the write appears in the Firestore console.
- [ ] **Offline cold boot.** Airplane mode, force-quit, relaunch: the skeleton
      must clear within a beat and show real plans from the Firestore cache,
      with forecast badges served `source: "cached"`. A skeleton that stays up
      means something on the boot path is awaiting the server.
- [ ] **Offline first launch after upgrade.** Install a build predating the
      migration, create plans, go into airplane mode, *then* upgrade and
      launch. The migration enqueues but cannot commit; the app must still
      reach a usable screen. Reconnect and confirm the writes land.
- [ ] **The local→cloud migration.** Populate MMKV with existing data (or run
      a build predating this change), upgrade, confirm all plans/routines/
      settings appear under the new anonymous uid exactly once. Relaunch
      several times to confirm no duplication. Kill the app between the
      enqueue and the commit and confirm the retry is an overwrite, not a
      duplicate.
- [ ] **The two-device materialisation race.** Install on two devices sharing
      a uid, let device A materialise a routine, then cold-boot device B with
      a stale cache and confirm you end with one slot per routine day, not
      two.
- [ ] **Account linking, requirement 1.** Create plans anonymously, link to a
      brand-new Google account, confirm every plan is still there and the uid
      is unchanged.
- [ ] **Account linking, requirement 2.** Create plans anonymously on a second
      device, sign in to the account from requirement 1, take the "Add"
      option, and confirm the app shows the union of both sets. Repeat taking
      "Don't add" and confirm the local plans are dropped and the account's
      own plans show. Kill the app mid-merge and confirm the next launch
      finishes it.
- [ ] **No re-migration into the joined account.** After a successful "Add"
      merge, delete one of the plans that came across, then cold boot. It must
      stay deleted — if it returns, the merge failed to set
      `brelly-migration-complete:{newUid}` and the frozen pre-migration blobs
      are being re-uploaded.
- [ ] **`firestore.rules` under the Local Emulator Suite.** Confirm a
      read/write is rejected for a uid that doesn't match `request.auth.uid`,
      and that a write with a malformed field (wrong type, missing
      `date`/`startTime`/`endTime`, an over-length `label`/`notes`, a
      `notificationId`/`digestNotificationId` key) is rejected too.
