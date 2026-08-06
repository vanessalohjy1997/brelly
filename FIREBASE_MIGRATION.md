# Firebase migration — phases 1–7

This is the working plan for moving brelly's storage off MMKV onto Firebase
(Firestore + Auth). **Phase 0 is done** — see "Progress so far" below. This
document exists so the remaining phases survive across sessions; it is not
one of the three docs `AGENTS.md` tracks (`PLAN.md`/`NOTES.md`/`UX.md`) — fold
the relevant pieces into those once the migration ships, per their usual
"move finished work out" convention.

## Context

Brelly currently stores everything (itinerary plans, routines, settings)
locally on-device in MMKV via three Zustand `persist` stores
(`src/store/itineraryStore.ts`, `src/store/routineStore.ts`,
`src/store/settingsStore.ts`), through a shared adapter
(`src/store/mmkvStorage.ts`). There was no account system before this
migration started — `PLAN.md`'s already-shipped "Export/import a JSON
backup" feature (`src/services/backup.ts`) exists specifically *because*
MMKV is device-local with no other backup path.

Decisions made before implementation started:

- **Auth: anonymous Firebase Auth now, plus an optional "back up your data"
  account-linking flow.** No forced sign-in screen — `signInAnonymously()`
  runs silently on first launch, preserving today's zero-friction first run.
  A user can later link that identity to Google/Apple/email from Settings
  without any data migration (same uid).
- **Must keep working fully offline** — this is a weather-driven
  outdoor-plans app; offline add/edit of plans is a hard requirement. This
  rules out the plain Firebase JS SDK (weak RN offline persistence) in favor
  of `@react-native-firebase` (native SDK, full offline cache).
- **All three stores migrate**, including settings — not just
  itinerary/routines.

## Progress so far

- **Phase 0 (deps & config) — done.** `@react-native-firebase/app`,
  `/auth`, `/firestore` (26.1.0), `@react-native-google-signin/google-signin`
  (16.1.4), `expo-apple-authentication` (57.0.1) added to `package.json`;
  config plugins registered in `app.json`; `GoogleService-Info.plist` /
  `google-services.json` gitignored. `npx tsc --noEmit`, `yarn lint`,
  `yarn test` all clean with nothing importing Firebase yet.
- `app.json` has since been hand-edited (bundle id/package now
  `com.brelly.app`, `expo-build-properties` added with
  `ios.useFrameworks: "dynamic"` — needed for RNFirebase's static-library
  linking on iOS).
- `src/services/auth.ts` has been started: `configureGoogleSignIn()`,
  configuring `GoogleSignin` with the Firebase-generated web client ID via
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. This belongs to phase 6 (account
  linking) but nothing else in phase 6 depends on phases 1–5 being done
  first, so it's fine that it's arriving early — just don't wire it up to a
  UI flow until `linkWithCredential` (phase 6) is in place.

## Architecture: keep every store action's public shape, swap what backs it

The design that avoids rewriting every screen: **every store action stays
synchronous and returns the same value it does today** (`addSlot` still
returns the new slot immediately, etc.). Firestore writes become
**fire-and-forget** underneath an optimistic local `set()`, and `onSnapshot`
listeners keep the in-memory Zustand state as a live mirror. Screens keep
reading via the same reactive selector hooks
(`useItineraryStore((s) => s.plans)`) — this is what makes the migration
invisible to `src/app/plan/new.tsx`, `plans.tsx`, `history.tsx`,
`plan/[id].tsx`, `index.tsx`, `SlotForm.tsx`.

MMKV is **not removed** — it changes role from source of truth to
"boot-time seed": on cold start, the store's initial state is read
synchronously from the last-known MMKV blob (avoiding a blank-screen flash
before the first Firestore snapshot arrives), then the `onSnapshot` listener
takes over. This MMKV blob is also exactly the source data for the one-time
local→cloud migration below.

### Firestore data model

```
users/{uid}/slots/{slotId}           — one doc per ItinerarySlot (flat; date is a field)
users/{uid}/routines/{routineId}     — one doc per Routine
users/{uid}/settings/app             — single doc for all of SettingsState
users/{uid}/meta/migration           — sentinel written once local→cloud migration completes
```

`DayPlan` stops being a stored entity — today's `fileSlot`/`removeSlot` in
`itineraryStore.ts` rewrite a whole `DayPlan.slots` array per edit, which
doesn't map onto Firestore's per-document model. Replace it with a pure
`groupSlotsIntoPlans(slots: ItinerarySlot[]): DayPlan[]` added to
`src/utils/planSelectors.ts` (matches this file's existing
plain-data-in/plain-data-out pattern), using the `date` string as
`DayPlan.id` since nothing downstream treats it as more than a React key.

Routines stay one doc per routine, keyed by their existing `id`.
`addException`/`removeException` become `arrayUnion`/`arrayRemove` on that
doc's `exceptions` field — an atomicity improvement over today's full-array
MMKV rewrite.

Settings as a single doc matches the plan's own framing. Because Zustand's
`persist` today does an implicit `{...defaults, ...persisted}` merge on
rehydrate (why new settings keys never needed a migration), the Firestore
`onSnapshot` handler must reproduce that merge explicitly: extract
`DEFAULT_SETTINGS` from `settingsStore.ts` and apply
`setState({ ...DEFAULT_SETTINGS, ...snapshot.data() })` on every snapshot.
Port the existing `migrate` function (v2, sets `hasSeenOnboarding: true`)
into a plain testable `migrateSettingsDoc(raw, schemaVersion)` called from
that same handler.

### IDs

Drop the duplicated `generateId()`
(`Math.random().toString(36).slice(2,9)`, in both `itineraryStore.ts` and
`routineStore.ts`) for `firestore().collection(path).doc().id` — a
collision-proof id generated client-side with no network round trip, which
is what lets `addSlot` mint an id and return synchronously before any write
happens. Existing locally-persisted 7-char ids are valid Firestore doc ids
as-is and get reused verbatim during migration — no foreign-key remapping
needed (`routineId`, notification bookkeeping, etc. keep working).

### One-time local → cloud migration

New file `src/services/localDataMigration.ts`, run from a new
`useCloudBootstrap()` hook mounted once in `src/app/_layout.tsx` alongside
the existing `useRoutineSync()`/`useNotificationSync()`, and must resolve
before any `subscribeX(uid)` listener attaches:

1. `signInAnonymously()` if no current user (every existing install gets a
   *new* anonymous uid the first time it runs this version).
2. Check a local-only MMKV flag (`brelly-migration-complete`) — instant, no
   network; skip straight to attaching listeners if set.
3. If not set: read the raw MMKV blobs (`brelly-itinerary`,
   `brelly-routines`, `brelly-settings`) directly, and upload via
   `firestore().batch()`, chunked to ≤400 writes (Firestore's cap is 500; a
   routine can generate ~260 archived slots/year per `NOTES.md`, so
   long-lived installs need chunking).
4. Guard against double-migration (reinstall, race) with a transactional
   check against `users/{uid}/meta/migration` before committing.
5. Set the local flag only after the remote commit succeeds, so a failure
   retries next launch (idempotent via the sentinel doc).
6. Only then attach the itinerary/routine/settings `onSnapshot` listeners.

Because the MMKV read in step 3 is the same data the store's cold-boot seed
already shows, there's no visible flash regardless of how long steps 1–5
take.

### Security rules

New root file `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Anonymous auth satisfies `request.auth != null`, and the uid is exactly what
account-linking preserves — this is why linking later needs no data
migration. Tighten with field validation (require `date`/`startTime`/
`endTime` as strings, cap `label`/`notes` length) before this ships to
production, in the final phase rather than up front.

### `saveWithFeedback.ts`

Keep its signature `action: () => T` — do **not** change it to
`() => Promise<T>`. There's no longer a synchronous-throw path to catch
(Firestore's local-cache write essentially never throws the way
`mmkv.set()` could on disk-full), so only its doc comment (which currently
explains the old synchronous-throw premise) needs rewriting. The
`try { action() } catch {}` body is unchanged.

The success toast should fire **optimistically**, before the write reaches
the server — consistent with today (MMKV writes were always local-only,
there was never a "confirmed by a server" wait). For genuine background
failures (permission-denied, bad auth token) that surface *after* the
original call already returned, add a small sibling helper that each
store's fire-and-forget `.catch()` calls, reusing the existing
`showToast`/haptic-error primitives — a generic "Couldn't sync to the
cloud — you're still working locally" message. All 8 existing
`saveWithFeedback` call sites need no signature changes.

### `useRoutineMaterializer.ts` / `useCalendarSync.ts`

Both read `.getState()` synchronously and trust it reflects "now." Because
every action's optimistic `set()` still lands before it returns, and the
in-memory mirror is always kept current by the subscription, **both keep
working with no structural change**. The one edge case worth a one-line
comment at each call site (not new machinery): right after a cold boot,
before the first Firestore snapshot lands, these read the MMKV-seeded
state — correct for an existing single-device install, but could briefly
miss a write made from a second linked device since the last local sync.
This is a pre-existing single-device assumption, not a new hazard.

### `backup.ts`

Keep, lightly repurpose — it stays useful as a manual, account-independent
export/import path (e.g. moving to a fresh anonymous identity without
linking). Firestore becomes the *automatic* backup; the JSON export/import
remains the manual/cross-account fallback. `importBackup`'s loop keeps
calling the same synchronous store actions (`restoreSlot`/`addRoutine`/
settings setters — no interface change), but batch its underlying Firestore
writes through the same `firestore().batch()` chunking as the migration,
rather than one write per action call, for large imports.

## New dependencies & config

- `@react-native-firebase/app`, `/auth`, `/firestore` — done in phase 0.
- `expo-apple-authentication` and `@react-native-google-signin/google-signin`
  for account linking — done in phase 0. No new id-generation package
  needed — Firestore's `.doc().id` covers it.
- `app.json` plugin config and gitignored Google Service file paths — done
  in phase 0 (bundle id/package have since been changed to `com.brelly.app`,
  and `expo-build-properties` added for `ios.useFrameworks: "dynamic"`).
- Since `ios`/`android` are gitignored/generated, config changes take effect
  on the next `expo prebuild` (which `expo run:ios`/`run:android` already
  trigger) — anyone with a stale prebuilt folder needs
  `expo prebuild --clean`. No `eas.json` exists yet, so there's no
  cloud-build config to touch for local dev.

## Account-linking screen

New modal route `src/app/account-link.tsx`, registered in `_layout.tsx`'s
`Stack` next to `settings`/`routines`, reached from a new "Back up your
data" row in the existing Backup section of `src/app/settings.tsx` (~line
442, right by the current "Export data" button).

Providers: Google, Apple, email/password — **Apple Sign-In is required
alongside Google per App Store guidelines**. Flow: pick a provider → get its
credential → `auth().currentUser.linkWithCredential(credential)` → same
uid, nothing to migrate → row becomes "Backed up as {email/name}". On
`auth/credential-already-in-use` (this Google/Apple/email identity was
already linked to a *different* anonymous uid, e.g. a second device) —
that's a real two-uid data-merge case, explicitly **out of scope for this
pass**; surface a clear error and note it as a known follow-up.

## Testing

Follow the same structural-fake pattern already used for
`react-native-mmkv` in `jest.setup.js`: add `jest.mock` entries for
`@react-native-firebase/app`, `/auth`, `/firestore`, backed by a new
`src/test/fakeFirestore.ts` implementing just the subset in use
(`collection().doc().set/update/delete`, `onSnapshot`, `batch()`,
`runTransaction`) — same philosophy as `forecastCache.ts`'s structural
`CacheStorage` type. Because store action signatures don't change, most
existing `useItineraryStore.setState(...)`-style test setup keeps working
verbatim once these mocks exist. Files that need the new mocks to keep
passing: `itineraryStore.test.ts`, `routineStore.test.ts`,
`SlotForm.test.tsx`, `useCalendarSync.test.tsx`,
`useNotificationSync.test.tsx`, `useRoutineMaterializer.test.tsx`, and
screen tests under `src/test/screens/`.

New pure logic (`groupSlotsIntoPlans`, `migrateSettingsDoc`) gets ordinary
unit tests with no Firestore mocking, per this repo's existing preference.
Real listener/offline/security-rule behavior is better covered by the
Firebase Local Emulator Suite as a separate opt-in target
(`yarn test:emulator`) — not folded into the `yarn test` gate
`PLAN.md`/`AGENTS.md` require clean on every change, since it needs a
running emulator process.

## Phases

### Phase 1 — anonymous auth bootstrap only

New `src/services/firebase.ts`, `useCloudAuthBootstrap()` mounted in
`_layout.tsx`. Nothing reads/writes Firestore yet. Add the auth jest mock.

### Phase 2 — `settingsStore` → Firestore

Simplest case (single doc, no grouping/id generation) — exercises the
mirror pattern, the `DEFAULT_SETTINGS` merge, and a settings-only slice of
`localDataMigration.ts`.

### Phase 3 — `routineStore` → Firestore

One doc per routine, `arrayUnion`/`arrayRemove` for exceptions. Extend the
migration.

### Phase 4 — `itineraryStore` → Firestore + full local migration + dependent-hook review

The big phase: flat `slots` collection, `groupSlotsIntoPlans`, id
generation via `.doc().id`, `useRoutineMaterializer.ts`/
`useCalendarSync.ts` comment review, `backup.ts` batching update,
`localDataMigration.ts` completed and exercised end-to-end for all three
stores together.

### Phase 5 — account linking

`account-link.tsx`, Google/Apple/email providers, `linkWithCredential`, new
Settings entry point. (`src/services/auth.ts`'s `configureGoogleSignIn()`
is already started — see "Progress so far.")

### Phase 6 — security rules hardening + cleanup

Tighten `firestore.rules` with field validation, then move finished work
out of `PLAN.md` into `NOTES.md` per this repo's own convention.

Land phases as separate PRs/commits where practical — each is
independently verifiable against `npx tsc --noEmit`, `yarn lint`,
`yarn test`.

## Verification

- After each phase: `npx tsc --noEmit && yarn lint && yarn test` must stay
  clean (this repo's gate, `--max-warnings 0`).
- After phase 4 (itinerary): manually test offline — put the
  device/simulator in airplane mode, add/edit/delete a plan and a routine,
  confirm it works and the UI reflects the change immediately; reconnect
  and confirm the write appears in the Firestore console.
- After phase 4: test the local→cloud migration path specifically — seed
  MMKV with existing data (or run on a build that predates this change),
  upgrade, confirm all plans/routines/settings appear under the new
  anonymous user's Firestore docs exactly once (re-launch a few times to
  confirm no duplication).
- After phase 6: with the Firebase Local Emulator Suite running, confirm
  `firestore.rules` rejects a read/write for a uid that doesn't match
  `request.auth.uid`.
- After phase 6: manually test account linking with at least one provider
  (e.g. Google) end-to-end — link, kill and relaunch the app, confirm data
  persists and is still associated with the same account.
