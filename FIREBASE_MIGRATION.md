# Firebase migration — phases 0–6

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
- **Must keep working fully offline** — this is a weather-driven
  outdoor-plans app; offline add/edit of plans is a hard requirement. This
  rules out the plain Firebase JS SDK (weak RN offline persistence) in favor
  of `@react-native-firebase` (native SDK, full offline cache).
- **All three stores migrate**, including settings — not just
  itinerary/routines.

### Multi-device is the goal (decided, and it drives everything below)

Two requirements, stated by the product owner, and they are the reason this
migration keeps the live-mirror architecture rather than a simpler
whole-store cloud backup:

1. **Anonymous → brand-new account.** Plans created before signing in must
   be in the account afterwards. This is exactly what `linkWithCredential`
   on the anonymous user gives us: the uid does not change, so the data is
   already in the right place and there is nothing to migrate.
2. **Anonymous → *existing* account.** The user must be *offered* the choice
   to add their local plans into that account, and afterwards the app must
   show the union — the plans they just brought across **and** the plans
   already stored in that account.

Requirement 2 is the `auth/credential-already-in-use` case. An earlier draft
of this plan declared it out of scope; it is now **in scope and is the
centrepiece of phase 5**. See "Account linking" below for why it cannot be
done as a cloud-to-cloud copy.

Because two devices genuinely will share one uid, a whole-store
last-write-wins blob would clobber: device A adds a plan, device B adds a
plan, each writes the whole store, one of them loses. Per-document writes
plus `onSnapshot` are what make concurrent editing safe, and they are also
what makes requirement 2's merge a per-document union rather than a conflict.

## Progress so far

- **Phase 0 (deps & config) — done.** `@react-native-firebase/app`,
  `/auth`, `/firestore` (26.1.0), `@react-native-google-signin/google-signin`
  (16.1.4), `expo-apple-authentication` (57.0.1) added to `package.json`;
  config plugins registered in `app.json`; `GoogleService-Info.plist` /
  `google-services.json` gitignored.
- `app.json` has since been hand-edited (bundle id/package now
  `com.brelly.app`, `expo-build-properties` added).
- `src/services/auth.ts` has been started: `configureGoogleSignIn()`,
  configuring `GoogleSignin` with the Firebase-generated web client ID via
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. This belongs to phase 5; nothing else
  in phase 5 depends on phases 1–4, so it arriving early is fine — just
  don't wire it to a UI flow until the linking work lands.

## Two corrections to make before writing any Firestore code

Both were found by checking the installed packages and the vendor docs
rather than working from memory, and both break things silently.

### The installed SDK is modular-only

`@react-native-firebase/firestore@26.1.0`'s entry point
(`dist/module/index.js`) declares itself "Modular Firestore API" and has **no
default export** — only named modular exports plus `export * from
"./modular"`. The namespaced API is gone. Every call must be written modular:

```ts
// NOT firestore().collection(path).doc().id
doc(collection(getFirestore(), path)).id
// NOT firestore().batch()
writeBatch(getFirestore())
// NOT auth().currentUser.linkWithCredential(cred)
linkWithCredential(getAuth().currentUser, cred)
```

This also constrains the test double: fake the modular *functions*
(`getFirestore`, `collection`, `doc`, `onSnapshot`, `writeBatch`,
`runTransaction`, `setDoc`, `updateDoc`, `deleteDoc`), not a chained
`collection().doc().set()` object, because that shape no longer exists.

### `useFrameworks` must be `"static"`, not `"dynamic"` — **done**

`app.json` set `ios.useFrameworks: "dynamic"`. rnfirebase.io's Expo
installation page specifies `"static"` — `firebase-ios-sdk` requires
`use_frameworks`, and static is the linkage it is built against. Nothing
catches this until a prebuild and pod install fail. Changed to `"static"`;
the next prebuild picks it up, and anyone holding a stale `ios/` folder needs
`expo prebuild --clean`.

## Architecture: keep every store action's public shape, swap what backs it

**Every store action stays synchronous and returns the same value it does
today** (`addSlot` still returns the new slot immediately). Firestore writes
become **fire-and-forget** underneath an optimistic local `set()`, and
`onSnapshot` listeners keep the in-memory Zustand state as a live mirror.
Screens keep reading via the same reactive selector hooks
(`useItineraryStore((s) => s.plans)`) — this is what makes the migration
invisible to `src/app/plan/new.tsx`, `plans.tsx`, `history.tsx`,
`plan/[id].tsx`, `index.tsx`, `SlotForm.tsx`.

MMKV is **not removed** — it changes role from source of truth to
"boot-time seed": on cold start, the store's initial state is read
synchronously from the last-known MMKV blob (avoiding a blank-screen flash
before the first Firestore snapshot arrives), then the `onSnapshot` listener
takes over. That seed is also the source data for the one-time local→cloud
migration.

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
`src/utils/planSelectors.ts` (matches that file's existing
plain-data-in/plain-data-out pattern), using the `date` string as
`DayPlan.id` since nothing downstream treats it as more than a React key.

Routines stay one doc per routine, keyed by their existing `id`.
`addException`/`removeException` become `arrayUnion`/`arrayRemove` on that
doc's `exceptions` field — an atomicity improvement over today's full-array
MMKV rewrite, and one that matters much more now that two devices can both
be editing exceptions.

Settings as a single doc. Because Zustand's `persist` today does an implicit
`{...defaults, ...persisted}` merge on rehydrate (why new settings keys never
needed a migration), the `onSnapshot` handler must reproduce that merge
explicitly: extract `DEFAULT_SETTINGS` from `settingsStore.ts` and apply
`setState({ ...DEFAULT_SETTINGS, ...snapshot.data() })` on every snapshot.
Port the existing `migrate` function (v2, sets `hasSeenOnboarding: true`)
into a plain testable `migrateSettingsDoc(raw, schemaVersion)` called from
that same handler.

### Device-local fields must never sync — this is a guaranteed bug otherwise

`ItinerarySlot.notificationId` and `notificationLeadMinutes`, and settings'
`digestNotificationId`, are handles into **this device's** OS notification
queue. They are meaningless on any other device.

`planNotificationResync` reads `hasAlert = !!slot.notificationId`
(`src/utils/planNotificationResync.ts:47`). A slot arriving from another
device with a foreign `notificationId` therefore looks permanently scheduled:
the resync sees "has an alert, still rainy, same lead time" and takes no
action, so **no rain alert is ever scheduled on this device for that stop**.
That is the app's main feature failing silently.

So: strip these fields on every write that crosses a device or account
boundary, and land them absent on read.

**`src/utils/stripNotificationHandles.ts` already exists for this** — added in
round 15 (see `NOTES.md`) when the same hazard turned out to have already
shipped in `backup.ts`, whose import handed raw slots to `restoreSlot`. Both
`backup.ts` and `useDeleteSlotWithUndo` now go through it. Every Firestore
write path added by this migration must too. The store's `restoreSlot`
deliberately does *not* strip — it files whatever it is handed — so the
obligation sits with the caller, which is exactly how `backup.ts` shipped
without it. Don't add a fourth call site that re-implements the two lines.

`digestNotificationId` is the settings-store equivalent and is not covered by
that helper; phase 2 has to exclude it from the settings document by hand.

### IDs

Drop the duplicated `generateId()` (`Math.random().toString(36).slice(2,9)`,
in both `itineraryStore.ts` and `routineStore.ts`) for
`doc(collection(getFirestore(), path)).id` — collision-proof, generated
client-side with no network round trip, which is what lets `addSlot` mint an
id and return synchronously before any write happens. Existing
locally-persisted 7-char ids are valid Firestore doc ids as-is and get reused
verbatim during migration — no foreign-key remapping needed (`routineId`,
notification bookkeeping, etc. keep working).

**Exception: routine-materialised slots get a deterministic id**,
`r_{routineId}_{date}`. See the next section for why — this is what makes
cross-device materialisation idempotent instead of duplicating.

One caveat that follows from it: detaching a slot with "this day only" must
**re-key it to a fresh random id** as well as clearing `routineId`. Otherwise,
if the user later removes that exception, the materialiser computes the same
deterministic id and overwrites the detached stop the user deliberately kept.
Re-keying matches the semantics anyway — after detaching, the stop is as
ordinary as a hand-made one, so it should carry an ordinary id.

### `useRoutineMaterializer.ts` — this DOES need a structural change

An earlier draft of this plan claimed the materialiser and `useCalendarSync`
"keep working with no structural change" and need only a comment. That was
true for a single device and is **false under multi-device**. It is the one
thing here that would ship broken and look fine for a fortnight.

`useRoutineSync` fires `latest.current()` from its mount effect
(`src/hooks/useRoutineMaterializer.ts:68`), immediately, at cold boot, reading
both stores through `getState()`. `planRoutineMaterialization` dedupes by
`(routineId, date)` — it builds a `filled` set from the plans it is handed and
skips dates already covered — so it is idempotent **given accurate state**. At
cold boot the state is the MMKV seed, which does not yet include what the
other device wrote.

Concretely: device A materialises 14 days of a routine and writes them.
Device B cold boots with a stale seed, the mount effect fires before the first
snapshot lands, `filled` is empty, so it emits 14 `add` actions — each minting
a *new* random id and writing a *new* document. The snapshot then arrives with
device A's 14. Result: 28 slots, two per day, each with its own rain
notification, permanently.

Two changes, and they are complementary:

1. **Deterministic ids for materialised slots** (`r_{routineId}_{date}`, as
   above). Both devices compute the same doc id, so the second write is an
   idempotent overwrite rather than a duplicate. This closes the race even
   when two devices foreground simultaneously and neither has seen the
   other's write yet — which gating alone cannot.
2. **Gate the first materialisation pass on cloud readiness.** Expose a
   "first snapshot has landed for slots and routines" flag from
   `useCloudBootstrap()` and have `useRoutineSync`'s mount effect await it.
   Foreground passes after that are already fine. This also avoids a burst of
   pointless writes on every cold start.

`useCalendarSync` reads `getState()` the same way but only ever acts on an
explicit user press, never on mount, so it is not exposed to the cold-boot
window. Leave it alone; a one-line comment is genuinely enough there.

### One-time local → cloud migration

New file `src/services/localDataMigration.ts`, run from a new
`useCloudBootstrap()` hook mounted once in `src/app/_layout.tsx` alongside
the existing `useRoutineSync()`/`useNotificationSync()`, and resolving before
any `subscribeX(uid)` listener attaches:

1. `signInAnonymously()` if no current user.
2. Check a local MMKV flag, **keyed by uid**
   (`brelly-migration-complete:{uid}`) — instant, no network; skip straight to
   attaching listeners if set. Keying by uid matters because phase 5's merge
   changes which uid this device is on.
3. If not set: read the raw MMKV blobs (`brelly-itinerary`,
   `brelly-routines`, `brelly-settings`) directly, strip the device-local
   notification fields, and upload via `writeBatch()`, chunked to ≤400 writes
   (Firestore's cap is 500; a routine can generate ~260 archived slots/year
   per `NOTES.md`, so long-lived installs need chunking).
4. Guard against double-migration (reinstall, race) with a transactional
   check against `users/{uid}/meta/migration` before committing.
5. Set the local flag only after the remote commit succeeds, so a failure
   retries next launch (idempotent via the sentinel doc).
6. Only then attach the `onSnapshot` listeners and flip the readiness flag
   the materialiser waits on.

Because the MMKV read in step 3 is the same data the store's cold-boot seed
already shows, there's no visible flash regardless of how long steps 1–5 take.

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
requirement 1's linking preserves. Tighten with field validation (require
`date`/`startTime`/`endTime` as strings, cap `label`/`notes` length) in the
final phase rather than up front.

Note the consequence for requirement 2, spelled out below: these rules are
what make a cloud-to-cloud account merge impossible from the client.

### `saveWithFeedback.ts`

Keep its signature `action: () => T` — do **not** change it to
`() => Promise<T>`. All 8 call sites need no changes.

Its doc comment currently explains a synchronous-throw premise that will no
longer hold (Firestore's local-cache write essentially never throws the way
`mmkv.set()` could on disk-full), so the comment needs rewriting even though
the `try { action() } catch {}` body does not. Note this is a real loss:
`NOTES.md` round 7 calls that failure branch "real, not decorative," and after
this it largely becomes decorative. That is a known cost of the architecture,
not an oversight.

The success toast fires **optimistically**, before the write reaches the
server — consistent with today, since MMKV writes were always local-only and
there was never a "confirmed by a server" wait. For genuine background
failures (permission-denied, bad auth token) that surface *after* the original
call returned, add a small sibling helper that each store's fire-and-forget
`.catch()` calls, reusing the existing `showToast`/haptic-error primitives —
a generic "Couldn't sync to the cloud — you're still working locally".

### `backup.ts`

Keep, lightly repurpose — it stays useful as a manual, account-independent
export/import path. Firestore becomes the *automatic* backup; the JSON
export/import remains the manual/cross-account fallback. `importBackup`'s loop
keeps calling the same synchronous store actions (no interface change), but
batch its underlying Firestore writes through the same `writeBatch()` chunking
as the migration, rather than one write per action call, for large imports.
Fix its notification-id leak at the same time (see above).

## Account linking — both requirements

New modal route `src/app/account-link.tsx`, registered in `_layout.tsx`'s
`Stack` next to `settings`/`routines`, reached from a new "Back up your data"
row in the existing Backup section of `src/app/settings.tsx` (~line 442, by
the current "Export data" button).

Providers: Google, Apple, email/password — **Apple Sign-In is required
alongside Google per App Store guidelines.**

### Requirement 1 — linking to a brand-new account

Pick a provider, get its credential, call
`linkWithCredential(getAuth().currentUser, credential)`. The uid does not
change, so every document already written under `users/{uid}/…` is
untouched and already belongs to the account. Nothing to migrate. The row
becomes "Backed up as {email/name}".

### Requirement 2 — linking to an account that already exists

`linkWithCredential` throws `auth/credential-already-in-use`. That is the
signal, not an error to surface.

**The constraint that dictates the whole design:** once we call
`signInWithCredential` and become the existing uid, the security rules above
block us from reading the *anonymous* uid's documents. There is no window in
which the client is authorised for both. So the merge cannot be a
cloud-to-cloud copy — it must be driven from the **local** copy of the data,
which we already hold in the Zustand stores and MMKV.

Flow:

1. Snapshot the current local state in memory — slots (flattened out of
   `plans`), routines, settings.
2. If that snapshot is empty, skip straight to step 4 with no prompt; there
   is nothing to offer.
3. Otherwise prompt: *"That account already has Brelly data. Add your N plans
   and M routines to it?"* — **Add** / **Don't add** / **Cancel**. This
   prompt is requirement 2's "option", and it must be a real choice: a user
   signing in on a borrowed device does not want their throwaway plans
   merged.
4. While still authenticated as the anonymous user, delete its
   `users/{anonUid}/…` documents. After the switch they are unreachable
   forever (rules), so this is the only chance to avoid orphaned, billed
   data.
5. `signInWithCredential(credential)` — now authenticated as the existing uid.
6. Tear down the old listeners and attach new ones for the new uid. Clear the
   MMKV seed so a stale cold boot can't reintroduce the old identity's data.
7. If the user chose **Add**: write the snapshotted slots and routines as a
   chunked `writeBatch()` under the new uid, preserving ids — **except** where
   the id already exists in the target, where a fresh id must be minted rather
   than overwriting. Overwriting would silently destroy a plan that already
   lived in the account, which is the worst possible outcome of a merge.
   Strip the device-local notification fields on everything that crosses.
8. **Settings do not merge.** They are scalar preferences and a union is
   meaningless — the account being joined is authoritative, so its settings
   win and the anonymous identity's are discarded. `digestNotificationId` is
   device-local and never crosses regardless.
9. The `onSnapshot` listeners deliver the union, so the app now shows both the
   plans brought across and the plans already in the account — requirement 2's
   second half, for free, because it is just what the mirror does.

Steps 4–7 are not atomic and cannot be: they span two auth identities. A
crash between 5 and 7 loses the un-merged local data. Mitigate by writing the
snapshot to a dedicated MMKV key *before* step 4 and clearing it only after
step 7 commits, so the next launch can finish an interrupted merge.

## New dependencies & config

- `@react-native-firebase/app`, `/auth`, `/firestore` — done in phase 0.
- `expo-apple-authentication` and `@react-native-google-signin/google-signin`
  for account linking — done in phase 0. No new id-generation package needed.
- `app.json` plugin config and gitignored Google Service file paths — done in
  phase 0. `ios.useFrameworks` corrected `"dynamic"` → `"static"`.
- Since `ios`/`android` are gitignored/generated, config changes take effect
  on the next `expo prebuild` (which `expo run:ios`/`run:android` trigger) —
  anyone with a stale prebuilt folder needs `expo prebuild --clean`. Per
  `NOTES.md`, follow with `rm -rf ios/Pods ios/Podfile.lock`, `npx
  pod-install`, and restart Metro with `--clear`.

## Testing

Follow the same structural-fake pattern already used for `react-native-mmkv`
in `jest.setup.js`: add `jest.mock` entries for `@react-native-firebase/app`,
`/auth`, `/firestore`, backed by a new `src/test/fakeFirestore.ts`
implementing just the **modular functions** in use — see the corrections
section; do not fake the removed chained API.

Because store action signatures don't change, most existing
`useItineraryStore.setState(...)`-style test setup keeps working verbatim once
these mocks exist. Files needing the new mocks to keep passing:
`itineraryStore.test.ts`, `routineStore.test.ts`, `SlotForm.test.tsx`,
`useCalendarSync.test.tsx`, `useNotificationSync.test.tsx`,
`useRoutineMaterializer.test.tsx`, and the screen tests under
`src/test/screens/`.

New pure logic gets ordinary unit tests with no Firestore mocking, per this
repo's existing preference: `groupSlotsIntoPlans`, `migrateSettingsDoc`, the
deterministic routine-slot id function, and the merge's id-collision
resolution (pure: given local items and existing target ids, return the writes).

Real listener/offline/security-rule/merge behaviour is better covered by the
Firebase Local Emulator Suite as a separate opt-in target
(`yarn test:emulator`) — not folded into the `yarn test` gate
`PLAN.md`/`AGENTS.md` require clean on every change, since it needs a running
emulator process. The emulator is now more valuable than it was: requirement
2's merge and the two-device materialisation race are both things unit tests
with a fake cannot honestly cover.

## Phases

### Phase 1 — anonymous auth bootstrap

New `src/services/firebase.ts`, `useCloudAuthBootstrap()` mounted in
`_layout.tsx`, written against the modular API. Nothing reads/writes Firestore
yet. Add the auth jest mock. (The `useFrameworks` correction is already done.)

### Phase 2 — `settingsStore` → Firestore

Simplest case (single doc, no grouping/id generation) — exercises the mirror
pattern, the `DEFAULT_SETTINGS` merge, `migrateSettingsDoc`, and a
settings-only slice of `localDataMigration.ts`. Strip `digestNotificationId`.

### Phase 3 — `routineStore` → Firestore

One doc per routine, `arrayUnion`/`arrayRemove` for exceptions. Extend the
migration.

### Phase 4 — `itineraryStore` → Firestore + migration + the materialiser fix

The big phase: flat `slots` collection, `groupSlotsIntoPlans`, id generation
via `doc(collection(…)).id`, **deterministic ids for materialised routine
slots**, **re-key on detach**, **cloud-readiness gating for
`useRoutineSync`**, `stripNotificationHandles` on every write path,
`useCalendarSync` comment, `backup.ts` write batching, and
`localDataMigration.ts` completed end-to-end for all three stores.
(`backup.ts`'s own notification-handle and routine-re-keying bugs are already
fixed — round 15.)

### Phase 5 — account linking, both requirements

`account-link.tsx`, Google/Apple/email providers, `linkWithCredential` for
requirement 1, and the full `credential-already-in-use` merge flow for
requirement 2, including the resumable snapshot. New Settings entry point.
(`configureGoogleSignIn()` is already started — see "Progress so far.")

This stays last of the functional phases because the merge writes slots,
routines and settings, so it needs all three stores already on Firestore.

### Phase 6 — security rules hardening + cleanup

Tighten `firestore.rules` with field validation, then move finished work out
of `PLAN.md` into `NOTES.md` per this repo's own convention. The
materialiser's deterministic-id rule and the device-local-field rule both
belong in `NOTES.md`'s "read this before writing code here" — they are
exactly the kind of trap that section exists for.

Land phases as separate PRs/commits where practical — each is independently
verifiable against `npx tsc --noEmit`, `yarn lint`, `yarn test`.

## Verification

- After each phase: `npx tsc --noEmit && yarn lint && yarn test` must stay
  clean (this repo's gate, `--max-warnings 0`).
- After phase 4: **offline** — airplane mode, add/edit/delete a plan and a
  routine, confirm the UI reflects it immediately; reconnect and confirm the
  write appears in the Firestore console.
- After phase 4: **the local→cloud migration** — seed MMKV with existing data
  (or run a build predating this change), upgrade, confirm all
  plans/routines/settings appear under the new anonymous uid exactly once.
  Relaunch several times to confirm no duplication.
- After phase 4: **the two-device materialisation race**, which is the one
  regression a single device cannot show you. Install on two devices sharing a
  uid, let device A materialise a routine, then cold-boot device B with a
  stale cache and confirm you end with one slot per routine day, not two.
- After phase 5: **requirement 1** — create plans anonymously, link to a brand
  new Google account, confirm every plan is still there and the uid is
  unchanged.
- After phase 5: **requirement 2** — create plans anonymously on a second
  device, sign in to the account from requirement 1, take the "Add" option,
  and confirm the app shows the union of both sets. Repeat taking "Don't add"
  and confirm the local plans are dropped and the account's own plans show.
  Kill the app mid-merge and confirm the next launch finishes it.
- After phase 6: with the Local Emulator Suite running, confirm
  `firestore.rules` rejects a read/write for a uid that doesn't match
  `request.auth.uid`.
