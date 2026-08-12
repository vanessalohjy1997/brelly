# Firebase migration — phases 0–6

This was the working plan for moving brelly's storage off MMKV onto Firebase
(Firestore + Auth). **All six phases are done** — see "Progress so far" below.
It is not one of the three docs `AGENTS.md` tracks (`PLAN.md`/`NOTES.md`/
`UX.md`); the condensed version is folded into
[`NOTES.md`'s round 16](NOTES.md#round-16--off-mmkv-onto-firestore) and the
outstanding manual QA lives in `PLAN.md`'s "Cloud sync" section, per their
usual "move finished work out" convention. This document stays on disk rather
than being deleted, though: dozens of comments across `src/` cite its section
names directly (`grep -rn FIREBASE_MIGRATION.md src/` to find them), so it now
serves as the permanent detailed design-rationale record for anyone who needs
more than the round-16 summary.

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
- **Phase 1 (anonymous auth bootstrap) — done, superseded by phase 2.**
  `src/services/firebase.ts` exposes `getFirebaseAuth()` and
  `ensureAnonymousUser()`, both written against the modular API (`getAuth()`,
  `signInAnonymously()`). The original `useCloudAuthBootstrap()` hook that
  only called `ensureAnonymousUser()` is gone — its one job is now the first
  step of phase 2's `useCloudBootstrap()`, since nothing needs auth-only
  bootstrap with no readiness flag any more. `jest.setup.js` gained a
  structural fake for `@react-native-firebase/auth` (just
  `getAuth`/`signInAnonymously`, the only two functions in use so far).
- **Phase 2 (`settingsStore` → Firestore + the skeleton) — done.**
  - `src/store/settingsStore.ts` no longer uses zustand `persist`. Every
    setter keeps its synchronous shape (`set()` first, unchanged callers) and
    now also fires `writeSettingsFields()` underneath it — a fire-and-forget
    partial `setDoc` merge, from the new `src/services/settingsSync.ts`.
    `setDigestNotificationId` is the one exception: it never calls
    `writeSettingsFields`, because `digestNotificationId` is device-local and
    excluded from `DEFAULT_SETTINGS` (now exported), which doubles as the
    settings doc's merge target on every snapshot.
  - `src/utils/migrateSettingsDoc.ts` holds `SETTINGS_SCHEMA_VERSION`, the
    pure `migrateSettingsDoc(raw, schemaVersion)` (ported from the old
    `persist` `migrate`, sets `hasSeenOnboarding: true` below version 2) and
    `toCloudSettingsFields` (whitelists the fields that belong in the cloud
    doc, i.e. excludes `digestNotificationId`). Both are unit-tested with no
    Firestore involved.
  - `src/services/settingsSync.ts` holds `writeSettingsFields` (the setters'
    fire-and-forget write, no-ops before a uid exists, reports a background
    failure via the new `notifyCloudSyncFailure` in `saveWithFeedback.ts`)
    and `subscribeToSettingsDoc` (the `onSnapshot` listener; has no knowledge
    of the zustand store on purpose — it hands migrated plain fields to a
    callback, which is what keeps it independently testable).
  - `src/services/localDataMigration.ts` holds the **settings-only slice** of
    the one-time local→cloud migration: `enqueueLocalDataMigration` (reads
    the raw `brelly-settings` MMKV blob, migrates it, writes it to the cloud
    doc, returns the commit promise unawaited) and
    `confirmLocalDataMigration` (awaits that promise off the boot path, sets
    the uid-keyed `brelly-migration-complete:{uid}` flag on success, leaves
    it unset on failure for a retry next launch). **This flag is shared
    across all three stores per the design above, but only settings occupies
    its gated block so far** — phases 3–4 must add routines'/slots' own
    migration steps to this same file, inside the same `if (already
    migrated) return` guard, *before* the flag is considered earned, not
    replace it.
  - `src/store/cloudSyncStore.ts` holds the readiness flag: `settingsReady`,
    plus a `useCloudReady()` selector. Only `settingsReady` feeds it for now;
    phases 3–4 add `slotsReady`/`routinesReady` and AND them together.
  - `src/hooks/useCloudBootstrap.ts` replaces `useCloudAuthBootstrap` — signs
    in anonymously, enqueues the migration, attaches the settings listener,
    and returns the readiness boolean. Mounted once in `_layout.tsx`, ahead
    of `useRoutineSync()`/`useNotificationSync()`, same as before. Nothing on
    its path awaits a server round trip.
  - `src/components/Skeleton.tsx` is the shared loading-placeholder primitive
    named in the architecture section above. **Not wired into any screen
    yet** — settings has no "not loaded vs. empty" ambiguity to protect (its
    defaults are always valid to render), so there is no consumer in phase 2.
    Phases 3–4 gate `index.tsx`/`plans.tsx`/`history.tsx`/`plan/[id].tsx` on
    `useCloudReady()` and render this while `!ready`.
  - `jest.setup.js` gained a structural fake for `@react-native-firebase/
    firestore`, backed by `src/test/fakeFirestore.ts` — an in-memory doc
    store keyed by path, faking `getFirestore`/`doc`/`setDoc`/`onSnapshot`
    only (the functions actually in use). `@react-native-firebase/app` still
    has no fake — nothing imports it directly yet.
- **Phase 3 (`routineStore` → Firestore) — done.**
  - `src/store/routineStore.ts` no longer uses zustand `persist`. Every
    action keeps its synchronous shape (`set()` first, unchanged callers,
    `addRoutine`/`restoreRoutine` still return the routine) and now also
    fires a fire-and-forget Firestore write underneath it, from the new
    `src/services/routinesSync.ts`. `addRoutine`/`restoreRoutine` write the
    whole doc; `updateRoutine` writes only the changed fields; `deleteRoutine`
    deletes the doc; `addException`/`removeException` use
    `arrayUnion`/`arrayRemove` on the doc's `exceptions` field rather than a
    full-doc rewrite, per the "multi-device is the goal" reasoning. Each of
    `updateRoutine`/`addException`/`removeException` first checks the routine
    is still present locally (via the store's new `get()` access) before
    firing its cloud write, matching the existing local no-op semantics for a
    routine that no longer exists. Ids still come from `generateId()` — the
    `doc(collection(…)).id` swap is a phase 4 item alongside the itinerary
    store's own `generateId()`.
  - `src/services/routinesSync.ts` holds `writeRoutine`, `writeRoutineFields`,
    `deleteRoutineDoc`, `addExceptionField`/`removeExceptionField`, and
    `subscribeToRoutinesCollection` — the collection equivalent of
    `settingsSync.ts`'s `subscribeToSettingsDoc`, with no knowledge of the
    zustand store, handing a plain `Routine[]` to its callback.
  - `src/services/localDataMigration.ts`'s `enqueueLocalDataMigration` now
    enqueues settings **and** routines inside the same gated block, and
    returns one combined commit promise (`Promise.all`) so
    `confirmLocalDataMigration` sets the migration-complete flag only once
    both have landed. The routines slice reads the raw `brelly-routines` MMKV
    blob and writes each routine to its own doc via `writeBatch()`, chunked
    to `MAX_BATCH_WRITES` (400) — headroom under Firestore's 500-write cap,
    the same chunking phase 4's larger slots collection will reuse.
  - `src/store/cloudSyncStore.ts` gained `routinesReady`/`setRoutinesReady`;
    `useCloudReady()` is now `settingsReady && routinesReady` and will AND in
    `slotsReady` when phase 4 lands.
  - `src/hooks/useCloudBootstrap.ts` additionally subscribes to
    `users/{uid}/routines` and hydrates `routineStore` with the plain array
    on every snapshot (`useRoutineStore.setState({ routines })` — no
    `{...defaults, ...fields}` merge needed, since a routine collection has no
    "missing key" case the way a single settings doc does).
  - `src/app/routines.tsx` now gates on `useCloudReady()`, rendering
    `<Skeleton>` ahead of its existing empty-state branch — this list has the
    same "not loaded vs. empty" ambiguity the empty-state screens have
    (`routines.length === 0` renders a confident "No routines" CTA), which
    settings never had (its defaults are always valid to render), so this is
    the first screen actually wired to the shared skeleton component landed
    in phase 2.
  - `src/test/fakeFirestore.ts` gained `collection`, batched `writeBatch`,
    `deleteDoc`, and the `arrayUnion`/`arrayRemove` field-value sentinels
    (resolved against the existing array field inside `FakeDocRef.set`, same
    as the real SDK). A collection's `onSnapshot` matches docs one path
    segment deeper than the collection path and re-notifies on every write or
    delete under it — still only the modular functions actually in use, per
    the testing section below.
- **Phase 4 (`itineraryStore` → Firestore + migration + the materialiser
  fix) — done.**
  - `src/services/itinerarySync.ts` is the new service, for the flat
    `users/{uid}/slots/{slotId}` collection (`date` lives on the doc).
    `writeSlot` (full-doc, for add/restore/detach-rekey) and `writeSlotFields`
    (partial merge, for a non-detaching `updateSlot`) both exclude
    `notificationId`/`notificationLeadMinutes` unconditionally. **Found while
    building this, not in the original plan:** a real Firestore merge write
    leaves an omitted field untouched rather than clearing it, and
    `SlotForm` submits `notes: notes.trim() || undefined` when a note is
    cleared — so `writeSlotFields` converts an `undefined`-valued key to the
    `deleteField()` sentinel rather than dropping it. `routinesSync.ts`'s
    `writeRoutineFields` has the same latent gap via
    `routineUpdatesFromSlot`'s `kind: slot.kind` (often undefined) — **not
    fixed**, flagged as a follow-up rather than folded into this phase.
    `subscribeToSlotsCollection` hands `groupSlotsIntoPlans`'s output (new,
    in `planSelectors.ts`) to its callback, same shape as the other two
    subscribe functions.
  - `src/services/firebase.ts` gained `generateDocId()`
    (`doc(collection(getFirestore(), "_autoIds")).id`), replacing the
    duplicated `generateId()` in both `itineraryStore.ts` and
    `routineStore.ts` per the "IDs" section above.
  - `src/store/itineraryStore.ts` lost `persist` the same way `routineStore`
    did in phase 3. `addSlot` takes an optional third `id` param — the
    routine materialiser's deterministic `r_{routineId}_{date}` ids are the
    only caller that uses it. `updateSlot`'s return type changed from `void`
    to `ItinerarySlot | undefined`: detaching a routine's stop ("this day
    only" in the edit screen, `routineId` explicitly cleared on a slot that
    had one) now re-keys the slot to a fresh `generateDocId()` id rather than
    editing in place, per the "IDs" section's re-key rule, and the caller
    needs the new id. `src/app/plan/[id].tsx`'s save handler now passes
    `saved.value` to `scheduleRainNotificationForSlot` instead of manually
    reconstructing the slot — the old reconstruction used the stale
    pre-render `slot.id`, which a detach leaves pointing at nothing.
  - `useRoutineMaterializer`'s add branch computes
    `materializedSlotId(routine.id, date)` (new, in `routineOccurrences.ts`)
    and passes it to `addSlot`. `useRoutineSync`'s mount effect is gated on
    `useCloudReady()` — the cold-boot empty-state race the "IDs" and
    materialiser sections above describe; the deterministic id makes a
    second write idempotent rather than duplicating, but an ungated mount
    effect still re-materialises every routine on every launch, which the
    gate is the actual fix for.
  - `src/store/cloudSyncStore.ts` gained `slotsReady`/`setSlotsReady`;
    `useCloudReady()` is now the AND of all three stores.
  - `src/services/localDataMigration.ts`'s `enqueueLocalDataMigration` now
    enqueues settings, routines, **and** slots in the same gated block.
    Slots are flattened out of `DayPlan.slots` via the existing
    `allSlotsWithDates`, stripped of notification handles, chunked the same
    way routines are.
  - `src/hooks/useCloudBootstrap.ts` additionally subscribes to
    `users/{uid}/slots` and hydrates `itineraryStore` on every snapshot.
  - `src/app/(tabs)/index.tsx`, `plans.tsx`, `history.tsx`, and
    `src/app/plan/[id].tsx` all gate on `useCloudReady()` now, rendering
    `<Skeleton>` ahead of their existing empty-state (or, for `plan/[id]`,
    "no longer exists") branch — same pattern `routines.tsx` used in phase 3.
  - `src/services/backup.ts`'s `importBackup` keeps calling
    `restoreSlot`/`restoreRoutine` unchanged, but additionally batches the
    Firestore side directly via chunked `writeBatch()`. This is on top of,
    not instead of, each `restoreSlot`/`restoreRoutine` call's own
    individual write — the two are redundant (same final doc state) but the
    explicit batch is what gives a large import atomicity within each chunk.
  - Manual QA (offline add/edit/delete, offline cold boot, the local→cloud
    migration, the two-device materialisation race) has **not** been run —
    it needs a real device/simulator. Recommended before shipping.
- **Phase 5 (account linking, both requirements) — done.**
  - `src/services/auth.ts` gained `getGoogleCredential()`,
    `getAppleCredential()` (iOS-only, no nonce — `expo-crypto` isn't a
    dependency and the SDK doesn't require one), and
    `getEmailCredential(email, password)` — the same credential shape covers
    both "new email" (linking creates the account) and "email already has an
    account" (linking throws `credential-already-in-use`).
  - `src/services/firebase.ts` gained `linkCurrentUser`,
    `signInWithLinkedCredential`, and `subscribeToAuthUser` (backs the new
    `src/hooks/useAuthUser.ts`, used by `settings.tsx` and
    `account-link.tsx` to show "Backed up as {email}" once linked).
  - `src/services/cloudListeners.ts` is new — `attachCloudListeners`/
    `detachCloudListeners` extracted out of `useCloudBootstrap`'s mount
    effect, so the merge flow can tear down and re-attach the three
    `onSnapshot` mirrors under a new uid outside of React's effect
    lifecycle. `useCloudBootstrap.ts` now just calls into it.
    `cloudSyncStore.ts` gained `resetReady()` for the merge's skeleton-reset
    step.
  - `src/utils/mergeLocalIntoAccount.ts` holds `resolveMergeWrites` — the
    one pure piece of the merge, given local items and the target account's
    existing ids, mints a fresh id (via an injected `mintId`) only on
    collision, and strips notification handles on every slot.
  - `src/services/accountLinkService.ts` is the orchestrator:
    `linkAnonymousAccount` (returns `"linked"` or `"merge-required"`),
    `snapshotLocalData` (Zustand stores, not MMKV — settings excluded, they
    never merge), `mergeIntoExistingAccount` (the 9-step flow: delete the
    anonymous uid's docs, switch identity, set
    `brelly-migration-complete:{newUid}` immediately post-switch — before
    anything else — so a crash can't leave the next boot re-uploading frozen
    pre-migration blobs into the joined account, then optionally write the
    snapshot with collision resolution, reattach listeners), and
    `resumePendingMergeIfNeeded` (called from `useCloudBootstrap`; resumes
    only when the current user is already the non-anonymous target — there's
    no credential left to resume an interrupted identity switch itself, so
    that narrow crash window, matching the doc's own "crash between 5 and 7"
    note, is accepted rather than further mitigated). The resumable snapshot
    lives at MMKV key `brelly-pending-merge`, written before any deletion
    and cleared only once the write commits. `localDataMigration.ts`'s
    `migrationFlagKey` was exported (was private) for reuse here.
  - `src/utils/promptMergeChoice.ts` is the three-button (`Add`/`Don't
    add`/`Cancel`) `Alert.alert` wrapper for requirement 2's prompt, same
    resolve-on-dismiss convention as the existing `askEditScope.ts`.
  - `src/app/account-link.tsx` is the new modal screen (registered in
    `_layout.tsx` next to `settings`/`routines`), reached from a new "Back
    up your data" row in `settings.tsx`'s Backup section. Google, Apple
    (iOS-only), and inline email/password rows, all funnelled through one
    `handleLink` that calls `linkAnonymousAccount` then, on
    `"merge-required"`, `snapshotLocalData` → (empty: merge quietly with no
    prompt; non-empty: `promptMergeChoice` → `mergeIntoExistingAccount`).
  - `firestore.rules` added at the repo root with the baseline
    `request.auth.uid == uid` rule — field-validation hardening is still
    phase 6.
  - Testing: `src/test/fakeAuth.ts` is a new stateful double (mutable
    `currentUser`, an `existingAccounts` registry for simulating
    `credential-already-in-use`) backing a rewritten
    `@react-native-firebase/auth` jest mock; `@react-native-google-signin/
    google-signin` and `expo-apple-authentication` also gained global
    structural mocks. `fakeFirestore.ts`'s `FakeWriteBatch` gained
    `.delete()` for the anonymous-uid cleanup. Every new function/hook/
    component has a co-located test; the account-link screen test drives it
    through the mocked service layer rather than the fakes directly.
  - Manual QA (both requirements, kill-mid-merge resumption, no
    re-migration into the joined account) has **not** been run — needs a
    real device/simulator with two real Google/Apple/email identities.
    Recommended before shipping.
- **Phase 6 (security rules hardening + cleanup) — done.**
  - `firestore.rules` now validates field shapes per collection, not just the
    owner check. Slots and routines require their non-optional fields present
    with the right type (`date`/`startTime`/`endTime` as strings, `latitude`/
    `longitude` as numbers, `neaRegion`/`kind`/`themePreference` as one of
    their known values, `weekdays` as a list of `0`–`6`), with `label`,
    `location` and `notes` length-capped. `notificationId`,
    `notificationLeadMinutes` and `digestNotificationId` are explicitly
    rejected — a server-side backstop to the client-side stripping in
    `stripNotificationHandles.ts`/`itinerarySync.ts`/`toCloudSettingsFields`,
    not a replacement for it. Settings' fields are all optional-if-present
    rather than required, unlike slots/routines: a slot or routine doc always
    starts life as a full-doc write, but settings' first write for a
    brand-new install can be a single setter's partial merge onto a doc that
    doesn't exist yet, and requiring every field would reject it. Verified by
    loading the rules file into the Firestore Local Emulator Suite and
    confirming a clean compile (no `firebase.json` checked in for this — a
    throwaway one pointed at the rules file, run via `firebase
    emulators:exec`, then discarded). Exercising the actual allow/deny
    decisions against real reads/writes needs the emulator running
    interactively against seeded data and is tracked as the last item in
    `PLAN.md`'s "Cloud sync" section instead.
  - The materialiser's deterministic-id rule and the device-local-field rule
    are now documented as traps in `NOTES.md`'s "read this before writing
    code here", per this phase's own instruction — see round 16 there for the
    condensed version of everything else in this document, and `PLAN.md`'s
    "Cloud sync" section for the outstanding manual QA carried over from the
    "Verification" section below.

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
`setDoc`, `updateDoc`, `deleteDoc`), not a chained
`collection().doc().set()` object, because that shape no longer exists.

### `useFrameworks` must be `"dynamic"`, not `"static"` — **done, reverted**

This was originally written the other way round, from rnfirebase.io's Expo
installation page, and it is wrong for the version we are on.
`@react-native-firebase` 26 resolves `firebase-ios-sdk` through **SPM**, and
that Swift Package only ships *dynamic* library products. With
`use_frameworks! :linkage => :static` every react-native-firebase pod embeds
its own copy of the same Firebase frameworks, so `pod install` now aborts
outright:

```
[react-native-firebase] SPM + static linkage is not supported (target(s): Pods-brelly).
```

`app.json` is back to `ios.useFrameworks: "dynamic"`. The only way to keep
static linkage would be `$RNFirebaseDisableSPM = true` in the Podfile before
the target block, which we do not need. Anyone holding a stale `ios/` folder
still needs `expo prebuild --clean`.

## Architecture: keep every store action's public shape, swap what backs it

**Every store action stays synchronous and returns the same value it does
today** (`addSlot` still returns the new slot immediately). Firestore writes
become **fire-and-forget** underneath an optimistic local `set()`, and
`onSnapshot` listeners keep the in-memory Zustand state as a live mirror.
Screens keep reading via the same reactive selector hooks
(`useItineraryStore((s) => s.plans)`) — so no screen changes how it *reads*
data: `src/app/plan/new.tsx`, `plans.tsx`, `history.tsx`, `plan/[id].tsx`,
`index.tsx`, `SlotForm.tsx` all keep their existing selectors. The one screen
change this migration does force is the loading skeleton, below.

### No MMKV "boot-time seed" — a readiness gate and a skeleton instead

**Decided.** An earlier draft kept MMKV as a synchronously-read boot seed so
the first frame had data. That is dropped. Zustand's `persist` middleware
comes off all three stores, and the cold-start gap is covered by a loading
skeleton gated on a cloud-readiness flag instead.

The reasoning: a seed is a *second source of truth* that has to be rewritten
on every snapshot to stay useful, and a stale one is what makes the
materialiser race (below) and the post-merge identity leak dangerous. A
skeleton has none of that. The cost is that a cold boot shows a skeleton for
a few hundred milliseconds instead of instant content — accepted.

Note what the skeleton is *not* waiting for: it is not waiting on the
network. It waits on Keychain auth restore plus the first cached `onSnapshot`
delivery, both of which complete offline. An offline cold boot is skeleton →
real plans from the Firestore cache → forecast badges served `source:
"cached"` per `NOTES.md`. Nothing here degrades the offline path.

What this leaves MMKV doing (`src/store/mmkvStorage.ts` stays):

- the existing **forecast cache**, untouched by this migration;
- the **raw pre-migration blobs** (`brelly-itinerary`, `brelly-routines`,
  `brelly-settings`) — read-only source data for the one-time local→cloud
  migration, never written again after it;
- the uid-keyed **`brelly-migration-complete:{uid}` flag**;
- the **resumable merge snapshot** in phase 5, which must survive an auth
  identity switch and so cannot live in a uid-scoped Firestore cache.

The readiness flag is the one `useCloudBootstrap()` already has to expose for
the materialiser — one flag, two consumers, no extra machinery.

**Screens must distinguish "not loaded" from "empty".** Without a seed the
stores start at their defaults, so `index.tsx`, `plans.tsx`, `history.tsx`
and `plan/[id].tsx` would otherwise render their empty states — with CTAs —
confidently, then swap. Each needs a skeleton branch on `!ready` ahead of its
existing empty-state branch. There is no shared skeleton component in the
repo yet (`WeatherBadge` is the only thing with a loading affordance), so
phase 2 should add one alongside the other primitives in `src/components/`.

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
skips dates already covered — so it is idempotent **given accurate state**.
With the seed dropped, the state at cold boot is not merely stale — it is
**empty**, until the first snapshot lands.

Concretely: device A materialises 14 days of a routine and writes them.
Device B cold boots, the mount effect fires before the first snapshot lands,
`filled` is empty, so it emits 14 `add` actions — each minting a *new* random
id and writing a *new* document. The snapshot then arrives with device A's 14.
Result: 28 slots, two per day, each with its own rain notification,
permanently.

Note this is now a **single-device** bug too, not just a two-device one: with
an empty cold-boot state, one device re-materialises its own routine days on
every launch. That makes the gating below mandatory rather than an
optimisation — it is the primary fix, and it is the same readiness flag the
skeleton uses.

Two changes:

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
the existing `useRoutineSync()`/`useNotificationSync()`.

**Nothing that waits on the server may gate the readiness flag.** This is the
one place dropping the seed changes the design, and it would ship as a hang.
`writeBatch().commit()` resolves on *server ack*, and `runTransaction()`
cannot run offline at all — it has no local-cache path. An earlier draft
attached listeners only after both had succeeded, and masked the wait behind
the seed ("no visible flash regardless of how long steps 1–5 take"). With a
skeleton instead of a seed, that same wait is a **skeleton that never
resolves** for a user who upgrades and first launches in airplane mode.

So the migration splits into an enqueue half that boot waits on, and a
confirmation half that it does not:

1. `signInAnonymously()` if no current user. Boot waits on this — it is
   Keychain-local on a returning launch and cannot be skipped, since the uid
   names every path.
2. Check the uid-keyed MMKV flag `brelly-migration-complete:{uid}` — instant,
   no network. If set, skip to step 5.
3. If not set: read the raw MMKV blobs (`brelly-itinerary`,
   `brelly-routines`, `brelly-settings`), strip the device-local notification
   fields, and **enqueue** the writes via `writeBatch()`, chunked to ≤400
   writes (Firestore's cap is 500; a routine can generate ~260 archived
   slots/year per `NOTES.md`, so long-lived installs need chunking). Do not
   await `commit()`. Firestore applies batched writes to the local cache
   immediately, so the first `onSnapshot` delivery already contains the
   migrated data whether or not the network exists.
4. Attach the `onSnapshot` listeners and flip the readiness flag. Boot is
   done here; the skeleton clears as soon as the first cached snapshot lands.
5. Off the boot path, `await` the commit promises. On success set the local
   flag and best-effort `setDoc` the `users/{uid}/meta/migration` sentinel
   (`{ merge: true }`, `.catch()`ed). On failure leave the flag unset and
   retry next launch.

**Re-running the migration is safe, which is what lets step 4 jump the
queue.** Existing locally-persisted ids are reused verbatim (see "IDs"), so a
re-upload is a same-doc-id overwrite, not a duplicate. That makes the
blocking transactional guard unnecessary — the sentinel doc downgrades from a
precondition to a diagnostic.

**One exception, and it is a real hazard:** after phase 5's merge into an
existing account the uid changes, so the step-2 flag is unset for the new uid
and the migration re-runs — uploading the *frozen pre-migration blobs* into
the joined account, resurrecting plans the user deleted months ago. With
`persist` removed those blobs are never refreshed, so they only get staler.
The merge must therefore set `brelly-migration-complete:{newUid}` itself as
part of step 7; the merge has already written everything that should cross.

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
which we already hold in the Zustand stores. (With `persist` removed the
stores are the only live copy — the MMKV blobs are frozen pre-migration data
and must **not** be used as the merge source.)

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
6. Drop the readiness flag back to false (the app shows the skeleton again
   here — this is a deliberate, user-initiated wait, not a cold-boot one),
   tear down the old listeners, and attach new ones for the new uid.
7. If the user chose **Add**: write the snapshotted slots and routines as a
   chunked `writeBatch()` under the new uid, preserving ids — **except** where
   the id already exists in the target, where a fresh id must be minted rather
   than overwriting. Overwriting would silently destroy a plan that already
   lived in the account, which is the worst possible outcome of a merge.
   Strip the device-local notification fields on everything that crosses.
   Then set `brelly-migration-complete:{newUid}` — see the migration section:
   without it the next cold boot re-uploads the frozen pre-migration blobs
   into the account the user just joined.
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
  phase 0. `ios.useFrameworks` stays `"dynamic"` — RNFirebase 26 + SPM
  rejects static linkage at `pod install`.
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
yet. Add the auth jest mock. (`useFrameworks` is settled — `"dynamic"`.)

### Phase 2 — `settingsStore` → Firestore + the skeleton

Simplest case (single doc, no grouping/id generation) — exercises the mirror
pattern, the `DEFAULT_SETTINGS` merge, `migrateSettingsDoc`, and a
settings-only slice of `localDataMigration.ts`. Strip `digestNotificationId`.

Also lands the readiness plumbing the rest of the migration depends on, since
this is the first phase where a store starts empty at boot: remove `persist`
from `settingsStore`, expose the readiness flag from `useCloudBootstrap()`,
and add the shared skeleton component. Phases 3–4 then only have to consume
them.

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
- After phase 4: **offline cold boot** — the case the skeleton replaces the
  seed for. Airplane mode, force-quit, relaunch: the skeleton must clear
  within a beat and show real plans from the Firestore cache, with forecast
  badges served `source: "cached"`. A skeleton that stays up means something
  on the boot path is awaiting the server.
- After phase 4: **offline first launch after upgrade** — the specific hang
  this design avoids. Install a build predating the migration, create plans,
  go into airplane mode, *then* upgrade and launch. The migration enqueues
  but cannot commit; the app must still reach a usable screen. Reconnect and
  confirm the writes land.
- After phase 4: **the local→cloud migration** — populate MMKV with existing
  data (or run a build predating this change), upgrade, confirm all
  plans/routines/settings appear under the new anonymous uid exactly once.
  Relaunch several times to confirm no duplication. Kill the app between the
  enqueue and the commit and confirm the retry is an overwrite, not a
  duplicate.
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
- After phase 5: **no re-migration into the joined account.** After a
  successful "Add" merge, delete one of the plans that came across, then cold
  boot. It must stay deleted — if it returns, step 7 failed to set
  `brelly-migration-complete:{newUid}` and the frozen pre-migration blobs are
  being re-uploaded.
- After phase 6: with the Local Emulator Suite running, confirm
  `firestore.rules` rejects a read/write for a uid that doesn't match
  `request.auth.uid`.
