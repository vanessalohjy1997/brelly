# Brelly on the web — a Next.js app in a monorepo

> **Revision 3.** Every count and file:line below was re-verified against `HEAD`
> (d583737) across two adversarial review rounds. Round 1 removed invented
> evidence. Round 2 caught four defects that the *fixes* had introduced —
> most importantly a merge reordering that would have guaranteed the data loss
> it was meant to prevent. Both are recorded inline as **"an earlier draft…"**
> notes, because the reasoning that produced them is the reasoning most likely
> to produce them again.
>
> Claims are marked ✔ where a reviewer reproduced them by running something,
> and **[unverified]** where they are expected but untested. Do not promote an
> unverified claim to a fact without measuring it.

## Context

Brelly is an Expo SDK 57 app: 16,246 non-test lines, 121 Jest test files
(118 under `src/`), weather (NEA in Singapore, Open-Meteo elsewhere) for
user-planned itinerary stops, backed by Firestore behind anonymous auth. There
is no web build today — `app.json` sets `web.output: "static"` and nothing has
ever been run through it.

The goal is a **web app that stands on its own**: real URLs, a desktop-shaped
layout, and the same plans/weather/routines/history/settings the phone shows,
reading and writing the same Firestore documents.

**Next.js was chosen** over Expo web for a genuinely web-shaped UI, real
shareable URLs and SSR. That decision is settled and is not revisited here. The
cost is accepted: `src/app` + `src/components` + `src/hooks` (**8,958 lines,
36 test files**) get rebuilt.

What makes this affordable is that the logic layer is *mostly* platform-clean,
and that the sync layer uses Firestore's **modular** API. ✔ The only Firestore
surface in non-test `src/` is `collection, doc, setDoc, deleteDoc, deleteField,
onSnapshot, writeBatch, arrayUnion, arrayRemove, getFirestore, Unsubscribe`, and
all eleven exist name-for-name in the installed `firebase@12.17.1`. There are
zero uses of `getDoc`, `getDocs`, `updateDoc`, `query`, `where`,
`serverTimestamp`, `Timestamp` or `.exists`.

**Name-for-name is not behaviour-for-behaviour**, and it is not
API-for-API either. Four differences are handled explicitly below: batch commit
resolution, cache-vs-server snapshots, default cache durability, and the fact
that `services/firebase.ts`'s *wrapper* functions exist in neither package.

## Decisions, locked

| | |
| --- | --- |
| Layout | Yarn 1 workspaces: `apps/mobile`, `apps/web`, `packages/core` |
| Web framework | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind v4, tokens generated from `src/constants/theme.ts` |
| Hosting | Firebase **Hosting** on `brelly.web.app` — a second site named `brelly`, not the project-id default — → rewrite → App Hosting backend. No custom domain |
| Feature scope | Graceful degradation — see "What web does not do" |
| Merge order | **Enumerate → persist → delete → switch identity.** Not reordered |

### Hosting and popup auth

`signInWithPopup` bounces through `/__/auth/handler`, which is served from
whatever `authDomain` names. When that is a *different* origin from the page,
the hop is cross-site and Safari's storage partitioning breaks it —
`signInWithRedirect` is **not** a fallback, partitioning breaks it identically.

**So the whole problem is one condition: the app and the auth handler must be
the same origin.** Everything below is in service of that, and nothing else.

**App Hosting alone does not satisfy it.** It serves from
`<backend>--<project>.<region>.hosted.app`, a different domain from the
`*.web.app` Hosting site that serves the handler, and the default
authorized-domains list holds two exact domains, not a wildcard.

⚠ An earlier draft reached for a **custom domain** to force the same-origin
condition, and locked it in as a decision. It is not needed, and the project is
not buying one. A Firebase Hosting site already serves `brelly.web.app`, and
that site serves `/__/**` itself — so putting the app there makes the handler
same-origin for free. The custom domain was one way to satisfy the condition,
never the condition itself.

`firebase.json` **has no `hosting` block at all** today, so this is new
configuration, not a setting. The concrete setup, two steps:

1. `firebase.json` gets a `hosting.rewrites` entry sending `**` to the App
   Hosting backend, leaving Hosting to serve `/__/**` itself. **This is the
   load-bearing piece** — it is what puts the Next app and the auth handler on
   one origin, and it is the piece to be suspicious of anyone simplifying away.
   Deploying straight to the App Hosting domain is the broken case above.
2. `authDomain` = `brelly.web.app`, the same origin the app is served from.
   That is `hosting.site` in `firebase.json`, and the two have to move
   together: `authDomain` is the origin the popup lands on, so a site rename
   that leaves `authDomain` behind makes the hop cross-site again.
3. **Two console lists gate this, and neither is code.** Auth's authorized
   domains and the Google OAuth client's *authorized redirect URIs* are
   separate, and the default-site domains are what Firebase seeds — ✔ verified
   at the time: `localhost`, `brelly-50de6.firebaseapp.com`,
   `brelly-50de6.web.app`. `brelly.web.app` is a *different host*, on a second
   Hosting site, so check for it in both and add it where it is missing:
   - Auth → Settings → **Authorized domains**: `brelly.web.app`.
   - The client Firebase auto-creates (`Web client (auto created by Google
     Service)`, id `87595606048-qfq1c45ssooq7hlaful6l5dveum901q6`), in the
     Google Cloud console → Google Auth Platform → Clients: add
     `https://brelly.web.app/__/auth/handler` to its **Authorized redirect
     URIs**. It was registered for `.firebaseapp.com`, then
     `brelly-50de6.web.app`; miss this one and every Google sign-in dies at
     Google with `Error 400: redirect_uri_mismatch`, before Firebase is
     consulted at all.

   Both are console changes; no code or env value is wrong when they bite.

Then test in Safari with "Prevent cross-site tracking" **on**. Same-origin
should make it a non-event, which is exactly why it is worth checking rather
than assuming: a regression here looks like nothing until someone signs in on
an iPhone.

~~Cheaper alternative worth evaluating first: Google Identity Services returns
an ID token straight to `signInWithCredential`, removing the handler hop for
Google entirely.~~ ✔ Moot. That was a way to avoid the *cost of the hop*, and
same-origin already removes it — for Apple as well as Google, where GIS never
helped. Adding it now buys a second auth path to maintain and nothing else.

## Target layout

```
brelly/
  package.json          workspaces, verify scripts, .githooks prepare
  firebase.json         + a NEW hosting block (rewrites → App Hosting)
                        on brelly.web.app; no custom domain
  firestore.rules  jest.emulator.config.js
  PLAN.md  NOTES.md  UX.md  AGENTS.md  .claude/  .github/  .githooks/
  .gitignore            web + repo-wide rules, incl. /apps/mobile/ios etc.
  tests/firestore-rules/          moved out of src/test/emulator/
  apps/
    mobile/             app.json, eas.json, plugins/, targets/, assets/,
                        ios/, android/, src/{app,components,hooks},
                        src/platform/, __mocks__/, jest.setup.js, tsconfig.json
      .env  GoogleService-Info.plist  google-services.json   (moved by hand)
    web/                Next.js: src/app/, src/components/, src/platform/
  packages/
    core/               services, utils, store, types, constants + the fakes
```

`.githooks/`, the root `prepare` script, and the four project docs stay at the
repo root — `.claude/hooks/session-context.sh` reads them from there.

**Where the native ignore rules live is a real choice, not an obvious one.** See
the fingerprint section: `isFileIgnoredAsync` shells `git check-ignore` from the
**VCS root**, so root rules (`/apps/mobile/ios`) and an `apps/mobile/.gitignore`
work identically for the mechanism that matters. Root rules are recommended —
one file, and the sub-file's only unique benefit (keeping a hashed source alive)
is worthless because the hash moves in Phase 2 regardless.

---

## The `packages/core` boundary

**Alias for behaviour, inject for values.** Add this rule to `AGENTS.md`.

Core imports bare specifiers that no package provides:

```ts
import { db, collection, doc, setDoc } from "@brelly/platform/firestore";
```

Each app resolves them in **its own** `tsconfig.json` `paths` — one declaration
read by three consumers: `tsc`, Metro (Expo's resolver honours tsconfig paths
natively) and Jest (`jest-expo`'s `withTypescriptMapping`; ✔ present at
`node_modules/jest-expo/src/preset/withTypescriptMapping.js:88`, called from
`jest-preset.js:128`, and it maps **array** targets to array `moduleNameMapper`
targets at line 31 — which is what makes c1.4 work).

```jsonc
// apps/mobile/tsconfig.json
"paths": {
  "@/*": ["./src/*"],
  "@/assets/*": ["./assets/*"],
  "@brelly/platform/*": ["./src/platform/*"]
},
"include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts",
            "../../packages/core/src/**/*.ts"]
```

Core is never compiled in isolation; it is compiled once inside each app's
project. So platform-implementation drift is caught by that app's
`tsc --noEmit` for free, and no hand-maintained contract interface is needed.

✔ The mock transitivity was verified rather than assumed: `jest.setup.js:79`
replaces `@react-native-firebase/firestore` wholesale, by specifier, with a
factory; a `src/platform/firestore.ts` re-export pulls the same `jest.fn`
instances out of the module registry, so identity assertions and
`jest.requireMock` still hold.

### The seam list — **eight**, not four

An earlier draft said four, then listed seven under a heading that still said
five. The real number is eight, and the eighth is the one that would have
blocked the whole extraction:

```
@brelly/platform/firestore      re-export of the 11 modular symbols
@brelly/platform/firebase       THE WRAPPERS — see below
@brelly/platform/auth           linkProvider / signInWithProvider
@brelly/platform/storage        mmkvStorage → localStorage
@brelly/platform/dialogs        Alert.alert → promise-returning dialog
@brelly/platform/haptics        → no-op on web
@brelly/platform/notifications  cancelAllNotifications → no-op on web
@brelly/platform/appSettings    openAppSettings() → returns false on web
@brelly/platform/random         randomUUID() — see the session-token section
```

**`@brelly/platform/firebase` is mandatory.** `services/firebase.ts` is forked
per platform, but six core-bound files import its *wrappers* —
`itinerarySync.ts:11`, `routinesSync.ts:13`, `settingsSync.ts:8`,
`accountLinkService.ts:11-19`, `itineraryStore.ts:2`, `routineStore.ts:3`. The
functions they want (`getFirebaseAuth`, `getFirebaseFirestore`, `generateDocId`,
`ensureAnonymousUser`, `linkCurrentUser`, `signInWithLinkedCredential`,
`signOutCurrentUser`) exist in **neither** `@react-native-firebase/firestore`
nor `firebase/firestore`, so the "same text" re-export cannot carry them. Without
this seam, core imports an app file and the boundary is a fiction.

`migrationFlagKey` (`accountLinkService.ts:20`, from `@/services/localDataMigration`,
which stays mobile-only; used at `:268,323,346`) is a pure string function —
**move it into core** rather than seaming it.

### Values: `configureCore()`

`EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` are literal bundler text substitutions that
no alias can bridge. ✔ There are **exactly two** module-scope `process.env` reads
in all of `src` — `services/geocoding.ts:3` and `services/auth.ts:10`; both
become call-time `getCoreConfig()`.

The Places config is a **discriminated union, not an optional key.** An earlier
draft had `places: { baseUrl: string; apiKey: string }`, which forces the web app
to supply *some* `apiKey` — and on web `configureCore()` runs client-side, so
Next inlines it into the browser bundle, defeating the `/api/places` proxy in the
same commit that adds it.

It also needs **two hosts, not one**: `geocoding.ts:1-2` holds
`places.googleapis.com/v1` (key in a header, `:55,97`) and
`maps.googleapis.com/maps/api/geocode/json` (key as a query param, `:186`) — two
different SKUs. A single `baseUrl` under-specifies it.

```ts
// packages/core/src/config.ts
export type PlacesConfig =
  | { mode: "direct"; apiKey: string }                       // mobile
  | { mode: "proxy"; placesPath: string; geocodePath: string }; // web → /api/places/*

export type CoreConfig = { places: PlacesConfig };
```

`googleWebClientId` is **not** in `CoreConfig`: its only reader is `auth.ts:10`,
which is forked per platform, so core never reads it and web would be supplying a
value it does not use.

`geocoding.ts` branches on `mode`. `configureCore()` is called from each app
entry **and from `jest.setup.js`**. Type-level protection is not enough on its
own — add a CI grep asserting no `NEXT_PUBLIC_.*PLACES` exists in `apps/web`.

### What lands where

Re-verify with a grep before each move commit; this is a starting point, not a
manifest.

- **Move untouched:** all `src/types/`, `constants/neaRegions.ts`, services
  `weather.ts` `openMeteo.ts` `airQuality.ts` `liveConditions.ts` `geocoding.ts`
  `forecastProvider.ts` `widgetSnapshot.ts`, stores `cloudSyncStore.ts`
  `toastStore.ts` `itineraryStore.ts` `routineStore.ts` `settingsStore.ts`,
  **44 of 48 utils** (✔ the four platform-dirty ones are `askEditScope.ts:1`,
  `confirmSignOut.ts:1`, `promptMergeChoice.ts:1`, `haptics.ts:1`).
- **Move with an import-specifier swap only:** `itinerarySync.ts`,
  `routinesSync.ts`, `settingsSync.ts`, `cloudListeners.ts`.
- **Move with real edits:** `accountLinkService.ts` — see below.
- **Fork per platform:** `services/firebase.ts`, `services/auth.ts`,
  `services/appSettings.ts` (✔ `:1` imports `Linking` from react-native),
  `store/mmkvStorage.ts` (→ `localStorage`), `utils/haptics.ts` (→ no-op),
  `utils/askEditScope.ts` / `confirmSignOut.ts` / `promptMergeChoice.ts` (already
  promise-returning — that *is* the seam), `constants/theme.ts` (two
  `Platform.select` at `:105` and `:176`, **plus `:6`'s `import "@/global.css"`,
  which the web fork must drop** — Next forbids global CSS imports outside the
  root layout), `store/deviceLocationStore.ts`.
- **Stays in `apps/mobile`:** `notifications.ts`, `notificationSync.ts`,
  `calendar.ts`, `widgetBridge.ts`, `backup.ts`, `localDataMigration.ts`
  (minus `migrationFlagKey`).

✔ Existing seams to reuse rather than reinvent: `utils/forecastCache.ts:8-11`
declares `CacheStorage = { getItem, setItem }` structurally and `localStorage`
satisfies it verbatim; `utils/otaUpdateState.ts` takes the seven `useUpdates()`
booleans as arguments; `utils/resolveColorScheme.ts` takes
`(preference, systemScheme)`.

### `accountLinkService` — the one place the boundary does not hold

Three platform dependencies beyond Firestore (`notifications`,
`localDataMigration`, `mmkvStorage`), plus a merge flow that does not survive a
`Promise<void>` seam.

Native acquires an `AuthCredential` and *then* links it. Web has no separable
acquisition step — `signInWithPopup` **is** the sign-in. But
`mergeIntoExistingAccount` (`:231-277`) takes a `credential` and calls
`signInWithLinkedCredential(credential)` at `:254`, so a `Promise<void>` seam
discards the one value the merge is built around, and a second popup issued after
an `await` is outside the user-gesture task and gets blocked.

The seam is the *intent* **plus an opaque credential handle**, and it must carry
email inputs, because `account-link.tsx:234` calls
`getEmailCredential(email.trim(), password)`:

```ts
// @brelly/platform/auth
// Each app aliases this to its own SDK's credential type. Not a brand —
// a brand forces a cast at every mobile signInWithLinkedCredential boundary.
export type PlatformCredential = /* app-specific alias */;

export type LinkRequest =
  | { provider: "google" | "apple" }
  | { provider: "email"; email: string; password: string };

export function linkProvider(r: LinkRequest): Promise<
  | { status: "linked" }
  | { status: "merge-required"; credential: PlatformCredential }
>;
export function signInWithProvider(r: LinkRequest): Promise<void>;
```

✔ `getEmailCredential` exists (`auth.ts:67`) and `isIdentityAlreadyInUse`
explicitly matches `auth/email-already-in-use` (`accountLinkService.ts:89`), so
`"email"` belongs in the union.

**Credential recovery differs by provider.** `OAuthProvider.credentialFromError`
is an OAuth-only static and returns `null` for `auth/email-already-in-use` — an
earlier draft named it as *the* mechanism, which is wrong for the provider it had
just added. Web recovers OAuth credentials from the thrown error, and rebuilds
the email credential with `EmailAuthProvider.credential(email, password)` from
inputs it already holds.

#### The merge order is load-bearing. Do not "fix" it.

An earlier draft proposed signing in *before* deleting the anonymous documents,
on the grounds that deleting before an unproven identity switch is dangerous.
**That is a guaranteed data-loss regression**, caught independently by two
reviewers. `firestore.rules:85,90,95,100` gate both read and delete on
`isOwner(uid)` — `request.auth.uid == <path uid>`. After
`signInWithLinkedCredential` (`:254`) the session is the *target* uid, so every
`batch.delete(doc(db,"users",anonUid,…))` at `:127`/`:136` and the `deleteDoc` at
`:141` fails `permission-denied`, and a batch fails wholesale. The anonymous
uid's documents become permanently orphaned — the exact outcome the plan cites
`firestore.rules:85` to warn about. Queued offline deletes flush under the new
token and fail too.

The `try/catch` at `:253-259` is the correct compensation for the correct order,
not a smell. The order stays:

```
read full docs (under anonUid) → persist → delete → switch identity
       └─ one value, reused by all three writes → restore-on-failure
```

Three real fixes remain, all compatible with that order:

1. **Read the anonymous account's documents — contents, not ids — before the
   switch, and use that one value everywhere `snapshot` is used today.**
   `:123`/`:132` walk `snapshot.slots` / `snapshot.routines` from the Zustand
   stores (`:70`). On web, a tab that starts a merge before `onSnapshot` has
   hydrated has an *empty* snapshot, so the delete silently orphans everything.

   The fix is **not** "enumerate the delete set from Firestore" on its own.
   `snapshot` feeds three call sites, and the safety property is that they are
   the *same value*:

   | job | call site |
   | --- | --- |
   | delete set | `deleteAnonymousUserData(anonUid, snapshot)` `:243` |
   | restore-on-failure | `writeMergeSnapshot(anonUid, snapshot)` `:255` |
   | merge into target | `writeMergeSnapshot(newUid, snapshot)` `:272` |

   Delete and restore drawing on one value is what makes the `catch` a genuine
   undo — the ids are reused verbatim, which is exactly what `:246-252` claims.
   Repoint the delete set alone and that breaks: the delete removes what
   Firestore holds, and the restore, still reading the empty local snapshot,
   hits `isSnapshotEmpty` at `:183` and **returns without writing anything**.

   > **An earlier draft** named `readExistingIds` (`:149`) as the fix. Two
   > things are wrong with it. It returns `{slotIds, routineIds}` as `Set`s of
   > **ids only** — nothing to restore *from* — and it changes the delete set
   > while leaving `:255` and `:272` on the local snapshot. In the very
   > scenario the fix cites — unhydrated tab, wrong password on the email path
   > — it deletes every document and restores none, converting today's
   > recoverable orphan into unrecoverable loss. This is the same failure as
   > the reordering above, arrived at from the opposite direction.

   So: add a pre-switch read of full document contents
   (`getDocsFromServer(collection(db, "users", anonUid, "slots"))` and the
   `routines` equivalent — `getDocsFromServer`, not `getDocs`, so an offline
   tab fails loudly instead of returning an empty cache as authoritative),
   shape it as a `LocalSnapshot`, and thread that one value through all three
   call sites in the table. It needs `isOwner(anonUid)`, so it must run
   pre-switch. **Keep the two reads distinct**: this anon-side read is
   pre-switch, the target-account read at `:185` is post-switch. Fix 3 settles
   *where* it lives — the merge prompt needs the same value, so it is read once
   at the call site and passed in, not read again inside.

   The scenario this has to produce, stated so a test can assert it — 40 slots
   in Firestore, empty local stores, email merge, wrong password: all 40 are
   deleted, sign-in rejects, all 40 are written back under their original ids,
   the caller sees the `auth/wrong-password` error and nothing else changed.
   Assert on document ids, not counts, or an id-minting regression passes.
2. **Persist the pending record unconditionally, and say which side it belongs
   on.** `:239-241` writes it only when `addLocalData` is true, so the
   *"Don't add"* branch runs the delete at `:243` with **no crash-recovery
   record at all**. The `catch` at `:255` covers a *rejected* sign-in; it
   cannot cover process death, and the in-memory value dies with the process.
   On a phone the window is narrow. A browser tab is closed casually,
   mid-flow, all the time.

   The single MMKV key is doing two jobs — crash record for the delete, and
   payload for the merge — and only the second one is conditional. Split them
   by widening the record:

   ```ts
   { anonUid, snapshot, addLocalData }   // written before every delete
   ```

   `resumePendingMergeIfNeeded` (`:339-348`) then has three cases instead of
   its current two:

   | state on next launch | action |
   | --- | --- |
   | signed in (non-anonymous) | as today: write into the target iff `addLocalData`, then clear |
   | still anonymous, uid **matches** `anonUid` | **write the snapshot back under `anonUid`**, same ids, then clear |
   | still anonymous, uid differs | leave the record in place — the rules would reject the write anyway |

   The middle row is new. Today `:343-344` bails on `user.isAnonymous` and
   leaves the record pending "rather than guessing" — correct when the record
   held only a merge payload, wrong once it also records a delete that already
   happened. Restoring to the same uid under the same ids is not a guess; it
   is the same undo the `catch` performs, just across a launch.

   Folded in, and still true: **it must not throw.** ✔ It runs at `:43-45` →
   `:240`, before `:243`'s delete. MMKV never throws; `localStorage.setItem`
   throws `QuotaExceededError` in Safari private mode. Make its failure abort
   the merge before any delete — a delete with no record is the thing this fix
   exists to prevent.
3. **`snapshot.isEmpty` at the call site means "the store has not loaded", not
   "this user has no data".** `account-link.tsx:68` short-circuits on it
   straight into `mergeIntoExistingAccount(credential, snapshot, false)` — the
   discard branch — **without showing `promptMergeChoice` at all**. On an
   unhydrated web tab that is a silent, unprompted discard of everything in
   Firestore. One line down, `:75-77` has the same flaw more visibly: it would
   ask *"Add your **0** plans and 0 routines to it?"*, and "Don't add" is the
   only sensible answer to that question.

   Both read the Zustand snapshot to decide something only Firestore knows, so
   both move onto fix 1's read. But the prompt happens *before*
   `mergeIntoExistingAccount` is called, so the read has to be hoisted to the
   call site rather than buried inside it:

   ```
   account-link.tsx:  cloud = await readAnonymousData(anonUid)   // one read
                      if (isEmpty(cloud)) → sign in, nothing to merge
                      choice = await promptMergeChoice(cloud.slots.length, …)
                      await mergeIntoExistingAccount(credential, cloud, choice === "add")
   ```

   That also settles what happens to `getLocalSnapshot` (`:70-75`): with `cloud`
   threaded through the delete, the restore and the merge, the Zustand read has
   no remaining caller and goes. Its `snapshot.isEmpty` field exists only for
   `:68`, and `:68` is the bug. Do not keep it "as a fast path" — a fast path
   that disagrees with Firestore is how this defect got here.

Also worth naming, pre-existing: the anonymous Firebase *auth* user is never
deleted (no `user.delete()` anywhere in the file), so each merge leaves an orphan
identity.

---

## Phase 0 — de-risk the harness (3 commits, no structure change)

> **Cut the baseline builds before this phase**, not before Phase 1 — every
> commit here touches `package.json` `scripts`, and the fingerprint hashes
> `scripts`. See *The fingerprint / OTA hazard*.

**c0.1 `fix: lint the whole repo, not just src/`** — must come **first**. An
earlier draft ordered the verify-gate rewire first, which would have landed red:
that commit sets `"lint": "eslint . --max-warnings 0"` while `eslint .` is still
failing.

✔ `expo lint` only ever lints `src/`, `app/`, `components/`
(`@expo/cli/build/src/lint/lintAsync.js:88`), so today `yarn lint` exits 0 while
`npx eslint . --max-warnings 0` exits 1 with **172 errors across 7 files** —
`jest.setup.js`, `plugins/withFirebaseSpmPostIntegrate.test.js`,
`app.config.test.js`, the other `plugins/*.test.js`, `__mocks__/*`.

The fix is bigger than adding globals. ✔ The 172 are **170 `no-undef` + 2
`react/display-name`** (`__mocks__/react-native-reanimated.js:16`,
`jest.setup.js:215`), and `.expo/types/router.d.ts` contributes an
unused-disable-directive **warning** that `--max-warnings 0` also fails on. So
c0.1 adds jest/node `languageOptions.globals`, ignores `.expo/`, **and** either
gives the mocks real `displayName`s or a scoped rules-off block. Budget it as
real work; the target is 0 with no `eslint-disable` added to source files.

**c0.2 `chore: route the verify gate through root scripts`**.
✔ `.claude/hooks/verify-gate.sh:20` hardcodes
`npx tsc --noEmit && yarn lint && yarn test`. After Phase 2 there is no root
`tsconfig.json`, so bare `tsc --noEmit` exits non-zero with `TS18003` and the
Stop hook blocks with an error that looks unrelated to the migration. ✔ Scope
note: `:16` short-circuits when `git status --porcelain` shows no dirty
`.ts/.tsx/.js/.jsx`, so it blocks on turns with uncommitted code, not on *every*
turn.

```jsonc
"typecheck":   "tsc --noEmit",
"lint":        "eslint . --max-warnings 0",
"verify:fast": "yarn typecheck && yarn lint && yarn test",
"verify":      "yarn typecheck && yarn lint && yarn test:coverage"
```

Point `verify-gate.sh` at `yarn verify:fast` and `ci.yml`'s Typecheck step at
`yarn typecheck`. **c2.3 owns the follow-up change** of `typecheck` to
`tsc --noEmit -p apps/mobile && tsc --noEmit -p apps/web` — otherwise this commit
merely relocates the breakage it exists to prevent, and no commit owns fixing it.

**c0.3 `chore: fire save haptics from the toast store, not saveWithFeedback`** —
✔ `utils/saveWithFeedback.ts:2` imports `utils/haptics.ts`, and its
`notifyCloudSyncFailure` (`:62`) is imported by all three sync services plus
`backup.ts`, so the whole sync layer transitively pulls `expo-haptics`.
`toastStore` is already the seam; subscribe once at the mobile entry.
`hapticDelete`/`hapticToggle` are called from UI components and stay put.

While in the file: `saveWithFeedback.ts:28` still documents a
`persist`/`mmkvStorage.setItem` path that no longer exists (✔ the stores dropped
`persist` — `itineraryStore.ts:119-125`, `settingsStore.ts:67-73`), so its
`try/catch` no longer catches anything. Delete the stale comment.

## Phase 1 — extract `packages/core`, root still the Expo app (15 commits)

Extraction **before** the physical move, deliberately. Every hard problem then
sits in one phase or the other: the move breaks *tooling*, the extraction breaks
*semantics*. Interleaved, every red test has two candidate causes. It also means
each file is renamed exactly once.

✔ Yarn 1 lets the repo root be both the workspace root and a real package
(1.22.22: root deps install to root `node_modules`, `packages/core` is symlinked
into `node_modules/@brelly/core`, and Jest realpaths through the symlink so
`transformIgnorePatterns` does not misfire).

**Dependency order is the whole design of this phase**, and an earlier draft got
it wrong: it moved the five stores at c1.9, before the sync layer. But
`itineraryStore.ts:2-3`, `routineStore.ts:3,10` and `settingsStore.ts:3` import
`@/services/{firebase,itinerarySync,routinesSync,settingsSync}`, so the stores
cannot precede the sync layer without the boundary rule firing on them and the
proof step failing for the wrong reason. Sync moves first; stores follow.

- **c1.1 `chore: turn the repo root into a yarn workspace root`** — config plus
  one stub file and stub test. Add `"workspaces": ["packages/*"]`, create
  `packages/core/package.json`. Widen `collectCoverageFrom` to include
  `packages/core/src/**` and add a **path-scoped** `coverageThreshold` key — ✔ a
  non-global key removes those files from the global group (Jest 29.7.0,
  `@jest/reporters/build/CoverageReporter.js:383-396`), so Jest prints two
  sub-totals from the first commit. Change `testPathIgnorePatterns` to
  `/node_modules/`.
  ✔ **No lockfile regeneration** — an earlier draft claimed Yarn 1 rewrites
  `yarn.lock` when `workspaces` appears; tested, it does not, and
  `--frozen-lockfile` passes byte-identical. The lockfile changes in Phase 3.
  ✔ Caveat to record: `coverageThreshold` path keys resolve against
  **`process.cwd()`**, not `rootDir` (`CoverageReporter.js:350`) — this is the
  load-bearing reason Phase 2 runs jest from inside each workspace.
- **c1.2** add the eight `src/platform/*.ts` seams + the tsconfig `paths` entry.
  Nothing consumes them yet.
- **c1.3** `configureCore()` instead of module-scope `EXPO_PUBLIC_` reads; move
  `migrationFlagKey` into core.
- **c1.4 `chore: widen the @/ alias to cover packages/core`** — config only, the
  scaffold that makes the moves pure renames. Both `tsconfig` paths and Jest
  `moduleNameMapper` take **array** targets:
  `"^@/(.*)$": ["<rootDir>/src/$1", "<rootDir>/packages/core/src/$1"]`.
- **c1.5–c1.8** four **pure `git mv` commits**: `types/` → `constants/neaRegions.ts`
  → 44 `utils/` → 7 pure `services/`. Each is green because c1.4 resolves either
  location.
- **c1.9** point the sync layer at `@brelly/platform/{firestore,firebase}` and
  move `itinerarySync`, `routinesSync`, `settingsSync`, `cloudListeners` into
  core.
- **c1.10** move the five stores. Their `@/services/*sync` imports now resolve
  into core through c1.4's array alias.
- **c1.11** move `accountLinkService.ts` — the auth, notifications and firebase
  seams plus the two merge fixes above. This file had **no commit at all** in an
  earlier draft despite the plan asserting its orchestration lives in core.
- **c1.12** codemod `@/x` → relative within `packages/core/**`, plus the
  `no-restricted-imports` boundary rule.
- **c1.13** codemod app-side imports to `@brelly/core`; write the barrel. **This
  includes the five sync test files' import specifiers** — see below.
- **c1.14 `chore: drop the temporary @/ fallback`** — remove the array targets.
  **This is the proof step**: anything still pointing into core now fails `tsc`
  and Jest by name.
- **c1.15** move `src/test/fakeAuth.ts` and `fakeFirestore.ts` into
  `packages/core/src/test/`; `jest.setup.js`'s two relative requires become
  `require("@brelly/core/test")`. Solving this *here* keeps Phase 2 a pure
  rename. Add `packages/core/jest.config.js` mapping `@brelly/platform/*` at the
  same fakes.

### What happens to the sync tests

An earlier draft claimed "all 115 tests pass unchanged, zero test files changed"
and made that c1.13's proof. It cannot hold, and the corrected version is still
worth stating precisely:

- The five sync tests **stay in `apps/mobile`** — they exercise the *mobile
  bindings*, and `accountLinkService.test.ts:5` imports `expo-notifications`,
  `:16` `@/store/mmkvStorage`.
- They **are not moved**, but their import specifiers **do change** in c1.13:
  `itinerarySync.test.ts:9`, `cloudListeners.test.ts:3-4` and
  `accountLinkService.test.ts:13` import `@/services/…`, which resolves into core
  only until c1.14 drops the fallback. After that they must say `@brelly/core`.
- ✔ The *mocking* half needs nothing: `jest.setup.js:79` mocks by specifier, and
  the re-export pulls the same `jest.fn`s.

So the honest proof for c1.9–c1.11 is: **no test file moves, no assertion
changes, and the only test diff is import specifiers.** That is still the
boundary design working.

## Phase 2 — the physical move (one PR, 4 commits)

> **Landed.** Three commits plus the native build, which is not a commit. See
> [round 38](NOTES.md#round-38--phase-2-of-the-web-migration-the-physical-move)
> for what this section got wrong: the coverage number, the ESLint rule-count
> check, and the two `import/no-unresolved` failures nobody predicted.

**c2.1 is a single commit** containing ~250 pure renames plus the config
relocation. Git rename detection is per-file, so splitting gains nothing and
would leave a broken intermediate commit.

An earlier draft justified the single commit by the Stop hook. ✔ That is wrong —
`verify-gate.sh:16` triggers on working-tree state, so a pause halfway through
250 `git mv`s blocks identically either way. The real mitigation is to **run the
move as one non-interactive script in a single tool call**.

**The move script must handle files `git mv` cannot touch — and there are two
kinds.**

✔ *Gitignored but load-bearing*, needing an explicit `mv`: `.env`
(`.gitignore:36` — holds `EXPO_PUBLIC_GOOGLE_PLACES_KEY` and
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), `GoogleService-Info.plist` and
`google-services.json` (`:39-40`). Expo loads `.env` from the project root only,
so without this a local run inlines `undefined` into `geocoding.ts:3` and
`auth.ts:10` — both use `!`, so it is **silent** — and `expo prebuild` dies
ENOENT on the plist. (`expo-env.d.ts`, `.gitignore:10`, needs no `mv`; `expo
start` and `ci.yml:34` regenerate it.)

*Untracked build output that would otherwise be stranded at the repo root*:
`ios/`, `android/`, `coverage/`, `targets/widget/Info.plist`,
`targets/widget/Assets.xcassets/`. `git mv` cannot move them; c2.2 then stops
ignoring them at the old paths, so they become trackable and **c2.2's own gate
(`prebuild --clean && git status --porcelain` empty) fails on artifacts that have
nothing to do with prebuild**. The script must `rm -rf` or relocate them too.

Reviewability comes from two commands in the PR body. An earlier draft's command
was wrong twice — `git show --numstat` always prints the commit header, and
`--diff-filter=R` hides both A+D pairs below the rename threshold and genuinely
modified files. ✔ And the corrected version still has a false-positive class:
a 100%-similar **binary** rename prints `-\t-`, so all ten `assets/icon/*.png`
would flag.

```
# every rename is byte-identical (expect: only the ~10 config files)
git show --numstat -M --format= HEAD \
  | awk '($1!="0" || $2!="0") && !($1=="-" && $2=="-")'

# and prove it by content, not by heuristic
# (expect: differs only by the ~10 config blobs, NOT empty)
diff <(git ls-tree -r HEAD^ | awk '{print $3}' | sort) \
     <(git ls-tree -r HEAD  | awk '{print $3}' | sort)
```

The reviewer's real job is then `git show --diff-filter=ACDMT HEAD` — about ten
config files. `git blame` and `log --follow` do rename detection by default;
**no `.git-blame-ignore-revs` entry**.

**c2.2 `.gitignore`.** ✔ `/ios`, `/android`, `/coverage` are anchored by a
leading slash — and so are **`targets/*/Info.plist` and
`targets/*/Assets.xcassets/`**, because a mid-pattern `/` anchors a rule the same
way (`.gitignore:48,49,54,55,58` are the only path-anchored rules; there is no
`.easignore`, `.eslintignore`, `.prettierignore`, `.gitattributes`, `.npmrc` or
`.fingerprintignore` anywhere).

Re-anchor them at the repo root (`/apps/mobile/ios`, etc.) and add `.next/`,
`out/`. ✔ A separate `apps/mobile/.gitignore` also works — `isFileIgnoredAsync`
shells `git check-ignore` from the VCS root — but buys nothing, for the reason in
the fingerprint section.

**c2.3 CI + EAS workflows** — see below. Also owns the `typecheck` script split.

**c2.4 the native build** — see the fingerprint section.

Also in this phase: move `src/test/emulator/` to root `tests/firestore-rules/`,
and repoint ✔ `jest.emulator.config.js:11`
(`testMatch: ["<rootDir>/src/test/emulator/**"]`).

Two content edits belong here:

- ✔ `plugins/withFirebaseSpmPostIntegrate.test.js:151-158` resolves
  `path.join(__dirname, '..', 'node_modules', '@react-native-firebase/app/firebase_spm.rb')`.
  Under `apps/mobile/` hoisting moves that path and the test ENOENTs — and it is
  precisely the test that catches an upstream re-anchor. ✔ The fix resolves and
  runs green: `path.join(path.dirname(require.resolve('@react-native-firebase/app/package.json')), 'firebase_spm.rb')`.
- Retire the root `package.json`'s inline `jest` key, or a stray root `npx jest`
  still picks up `preset: jest-expo` with `rootDir` at the repo root.

## Phase 3 — `apps/web` (purely additive, cannot break mobile)

`create-next-app`, then **immediately delete the lockfile it drops in
`apps/web/`** and re-run `yarn install` from the root.

Also drop, in the same commit: ✔ `react-native-web@~0.21.0` from root
`dependencies` (`package.json:46`, zero importers), and with it `app.json`'s now
meaningless `web: { output: "static", favicon }` block and the root
`"web": "expo start --web"` script.

### Routes

| Next.js route | From | Notes |
| --- | --- | --- |
| *root layout* | `_layout.tsx` (84) | `QueryClientProvider`, `ThemeProvider`, root `ToastHost`, `GestureHandlerRootView`, three root-mounted hooks, **three** module-scope calls (`:16-21`) |
| *tab shell* | `(tabs)/_layout.tsx` | Also needs a home; becomes the sidebar/bottom-bar shell |
| `/` | `(tabs)/index.tsx` (388) | Today. Four-way branch: skeleton / onboarding primer / no-plans / the day's cards |
| `/plans` | `(tabs)/plans.tsx` (393) | `WeekStrip`, conflict banners, search above 6 stops (`PlanSearchField.tsx:14`), day-grouped sections |
| `/history` | `(tabs)/history.tsx` (257) | Past stops, search, "clear older" prune |
| `/settings` | `(tabs)/settings.tsx` (828) | ✔ **Seven** sections (`:170,208,394,446,495,558,600`). Notifications, "Check your alerts", Calendar and App updates drop, leaving three |
| `/plan/new` | `plan/new.tsx` (107) | Ordinary route + an explicit guard — see below |
| `/plan/[id]` | `plan/[id].tsx` (396) | Same. Packing list, dry-window banner, duplicate-to-date, routine scope prompt |
| `/routines` | `routines.tsx` (149) | Read-only list. Decide what it becomes without modal presentation |
| `/account` | `account-link.tsx` (309) | Google / Apple / email. Same question |

✔ All line counts exact. `dev-weather-preview.tsx` (143) is marked *TEMPORARY —
visual QA only*: do not port.

**`QueryClient` must be created per request.** ✔ `_layout.tsx:23` constructs it at
module scope — correct in a single-user RN runtime, **wrong in a shared server
process on Cloud Run**, where it leaks cached query data across users. Create it
with `useState(() => new QueryClient())` inside a `"use client"` provider
(TanStack's documented Next pattern): per-request on the server, stable across
re-renders on the client.

#### The dirty-form guard needs a named mechanism, not a routing choice

✔ `useUnsavedChangesGuard.ts:24` sets `gestureEnabled: !dirty` — the native
design disables swipe-dismiss on a dirty form so Cancel, which asks, is the only
exit.

An earlier draft concluded from this that `/plan/*` should be ordinary routes
rather than `@modal` intercepting routes. **That is a non-sequitur**, and the
reviewer was right to call it: "App Router has no route-block API, `popstate` is
not cancelable, `beforeunload` only covers tab close" is equally true of an
ordinary route. Browser Back discards a dirty form silently either way —
`beforeunload` does not fire on same-document history navigation — and an
ordinary page *adds* a dismissal path the modal did not have: sidebar nav.

Ordinary routes are still the right call (simpler, genuinely shareable), but the
guard has to be built explicitly:

- a history sentinel pushed on dirty, re-pushed on `popstate`, with the confirm
  shown before allowing the pop;
- `Link` `onNavigate` `preventDefault()` (Next ≥15.3) for in-app navigation;
- `beforeunload` for tab close and reload only.

Two caveats to record. ✔ The native baseline is weaker than it looks —
`gestureEnabled` blocks the iOS swipe only; Android hardware back already
discards a dirty form, so "the button is the only exit" is iOS-only. And
`useUnsavedChangesGuard` itself does not port: `:22` uses `useNavigation`, which
has no `next/navigation` equivalent.

### Responsive shape

✔ `appTabs.tsx:1` is `expo-router/unstable-native-tabs` — a UIKit tab bar, total
rewrite. Web gets a sidebar at `>=768px` and a bottom bar below it.
`MaxContentWidth = 800` ports as `max-width: 800px`; the plans list goes
multi-column on wide screens.

### Design tokens

`src/constants/theme.ts` is the source: `Colors.light` / `Colors.dark` (every
neutral held between hue 250–261°, with measured contrast ratios in the comments
— preserve them), `Spacing`, `IconSize`, `MaxContentWidth`, `HeaderHeight`. A
build step emits CSS custom properties so **both apps stay on one palette**, per
the `ui-implementation` skill's rule that an untokened value is a stop-and-ask.

The gaps, all decisions rather than ports, all ✔ verified:

1. **Radius.** Not uniformly `Spacing.two`. Census: `Spacing.two`×31,
   `Spacing.three`×3 (`LiveConditionsCard.tsx:172`, `NearbyForecastPreview.tsx:133`,
   `NearbyWeatherPrompt.tsx:74`), a raw off-grid `10` (`WeekStrip.tsx:162`), a
   hairline `1` (`NearbyForecastPreview.tsx:161`), a full pill
   (`UmbrellaVerdictIcon.tsx:124`). A ≥4-step scale plus `full`.
2. **Font size.** **50 `fontSize:` declarations**, 40 outside `themedText.tsx`,
   across **6 screens and 11 components**, at exactly 11/12/13/14/15/16/18/20.
   `themedText.tsx`'s 10 variants are the scale; the other 40 are the debt — the
   same count `UX.md`'s Dynamic Type item cites.
3. **Tokens that do not exist at all**: shadow (`SlotForm.tsx:984-988`), z-index
   (`animatedIcon.tsx:100`, `SlotForm.tsx:959,966`), the repeated `0.14`
   watermark opacity (`ItineraryCard.tsx:419`, `LiveConditionsCard.tsx:183`) and
   `0.5` disabled opacity (`account-link.tsx:307`, `settings.tsx:826`), durations
   (`toast.tsx:22,30,119-120`), the 44pt hit target (**11 sites across 8 files**:
   `account-link:292,302`, `settings:819`, `UpdateBanner:81`,
   `OnboardingPermissionPrimer:127`, `NearbyWeatherPrompt:98`,
   `SlotForm:915,933`, `WeatherBadge:232,243`, `PlanSearchField:89`), and
   `DateTimePickerWidth/Height` (`shouldStackDateTimeFields.ts:22,34`).

Tokens alone do **not** buy Dynamic Type. `UX.md` names three breaking
constraints; rem-based sizing and removing fixed heights are the other two, and
the card's location-vs-weather flex split is not in the token list at all.

**`global.css` does not port unchanged.** ✔ It is 9 lines of `:root` font vars;
under Tailwind v4 it must host `@import "tailwindcss"` and the generated
`@theme`, so it is the one file guaranteed to change. And its stacks are
aspirational: `--font-display: Spline Sans, Inter, …` (`global.css:3`) loads
neither family — there is no `@font-face` and no font file under `assets/`
(`expo-font` *is* installed, `package.json:21` and `app.json:93`, but loads
nothing here) — and `--font-rounded: 'SF Pro Rounded'` resolves only on Apple
hardware, so on Windows and Linux display, sans and rounded collapse to one face.
Load via `next/font` or drop them. Note this is **web-only work**: `Fonts` is a
`Platform.select` (`theme.ts:123-128`), mobile never takes the `web` branch, and
the mobile fork drops `theme.ts:6` anyway.

**Dark mode needs an SSR story, and cookie-mirroring is a cache, not a fix.**
✔ `useTheme.ts:18` reads `useColorScheme()`, and `themePreference`
(`settingsStore.ts:26`) arrives from **Firestore** via `useCloudBootstrap`. Ship
`:root` light + `prefers-color-scheme` dark + a `data-theme` override. A mirrored
cookie helps returning visitors, but be honest about its limits: it can only be
written after the Firestore hop, so the first visit still flashes; a phone-side
change leaves it stale (wrong-theme SSR, then a visible correction); and a
per-user cookie makes App Hosting SSR uncacheable without `Vary: Cookie`.

### Components — the rework drivers

| Driver | Where | Web answer |
| --- | --- | --- |
| `expo-router` | **20 `router` imports**, 2 `useLocalSearchParams`, `useNavigation` (`useUnsavedChangesGuard.ts:22`) | The second-commonest native-only import. `next/navigation` covers most of it; `useNavigation` has no equivalent, so the guard hook is a rewrite |
| `react-native-safe-area-context` | ✔ 8 of 11 files in `src/app` (`index.tsx:4`, `plans.tsx:9`, `settings.tsx:4`, `history.tsx:3`, `routines.tsx:2`, `account-link.tsx:11`, `plan/new.tsx:3`, `plan/[id].tsx:5`) | The most widespread native import. CSS `env(safe-area-inset-*)` where it matters |
| `headerDismissButton.tsx` | ✔ **Three** screens (`account-link.tsx:116`, `plan/[id].tsx:166`, `plan/new.tsx:30`) — not four; `routines.tsx` has none. Uses `Stack.Screen`, `Stack.Toolbar`, `Platform.OS === "ios"` (`:25-36`) | Next has no header-options API — native navbar actions become in-page chrome |
| `@expo/ui` `DateTimePicker` | `SlotForm.tsx:1`, `RepeatField.tsx:1`, `CopyToDateAction.tsx:1` | `<input type="date">` / `<input type="time">` |
| `ReanimatedSwipeable` | `ItineraryCard.tsx:3` (498 lines, the core row) | **Always-visible or focus-revealed** buttons — not hover-only, which is unreachable by keyboard and on touch laptops. `accessibilityActions` (`:248-263`) carries the label set but is a rotor affordance only |
| `expo-symbols` | `icon.tsx:1` — every icon funnels through it | Material Symbols keyed off the same `IconName` shape |
| Reanimated | `toast.tsx:3`, `animatedIcon.tsx:5`, `ItineraryCard.tsx:5-7` | CSS transitions; drop `AnimatedSplashOverlay` |
| `AccessibilityInfo` | `useReduceMotion.ts:2,20,36`, gating `toast.tsx:119-120` and `animatedIcon` | `matchMedia("(prefers-reduced-motion: reduce)")` |
| `SectionList` / `FlatList` | plans, history, routines | Plain mapped `<section>`s — no virtualisation needed at Brelly's sizes |
| `Alert.alert` (✔ **5** sites) | `history:62`, `confirmSignOut:18`, `askEditScope:35`, `promptMergeChoice:20`, `useUnsavedChangesGuard:34` | A promise-returning dialog. The three in `src/utils/` are already promise-returning. `promptMergeChoice` is 3-way — `confirm()` will not do |
| `AppState` (5 hooks) | ✔ `useNotificationSync`, `useRoutineMaterializer`, `useOtaUpdate`, `useNotificationPermission`, `useDeviceLocationPermission` | `document.visibilitychange` |
| `RefreshControl` | Today, Plans | An explicit refresh button — `useWeatherRefresh` itself ports |
| `Switch`, `hitSlop` | settings; `WeekStrip.tsx:78` and throughout | No CSS equivalent for either — checkbox styling, and padding-based targets |
| `openAppSettings()` | ✔ `services/appSettings.ts:21`, from `settings.tsx:227` **and `:427`**, `NearbyWeatherPrompt.tsx:56`, `OnboardingPermissionPrimer.tsx:84`, `SlotForm.tsx:548` | **Five sites**, and the seam is `appSettings.ts` — ✔ `Linking` appears in no non-test screen, component or hook. Web returns `false`; all five need copy naming the browser's own permission control |
| `Location.reverseGeocodeAsync` | `useCurrentLocation.ts:92` | No browser equivalent. Web drops from two reverse-geocode providers to one, and `formatReverseGeocodedAddress` becomes dead code |

✔ Verified absent, so not drivers: `KeyboardAvoidingView`, `PanResponder`,
`ImagePicker`, `Clipboard`, `Share`, `StatusBar`, `LayoutAnimation`.

✔ The **toast host collapse is safe**: `toastStore.ts:33-50` names the iOS
view-controller barrier as the sole reason for per-modal hosts. A web portal has
no such barrier, and because the toast lives in the store rather than the host,
the survive-the-modal behaviour is preserved for free.

`SlotForm.tsx` (1,059 lines) is the largest single piece of work. Keep
`shouldStackDateTimeFields` as the single source of the breakpoint even though
CSS replaces `useWindowDimensions` (`SlotForm.tsx:136`, the only use).

### Accessibility

- **No heading hierarchy exists.** Nothing in `src/app` uses
  `accessibilityRole="header"`, so a document-shaped web app must invent h1/h2
  from `ThemedText type="title"/"eyebrow"`. Two RN-only roles need mapping:
  `radiogroup` (`settings.tsx:175`) and `summary` (`routines.tsx:25`, not an
  ARIA role at all).
- **`WeekStrip`** is 7 `Pressable`s in a horizontal `ScrollView` (`:71-116`).
  ✔ Each cell *adds a plan* — `plans.tsx:242` pushes `/plan/new`, so
  `onSelectDate` is a misnomer and the hint at `:77` is the only signal. Resolve
  the add-vs-select ambiguity first, then pick **one** keyboard model: a
  composite widget with a container role and roving `tabindex`, or 7 plain tab
  stops. The cells currently have `accessibilityRole="button"` and no container
  role, which is half of each.
- Focus must move into and back out of the plan form now that it is a page.

### Web Firestore semantics — four differences

1. **Durability.** The code relies on "Firestore applies writes to the local
   cache synchronously regardless of network", free on RNFB. The web SDK's
   default cache is **memory-only**, so an offline edit is lost on reload with no
   error. ✔ This is now the *only* local durability there is (`itineraryStore.ts:119-125`,
   `routineStore.ts:50-56`, `settingsStore.ts:67-73` each record that `persist`
   was removed). And the failure is worse than a lost edit: with a memory cache
   and no network, `attachCloudListeners` (`useCloudBootstrap.ts:32`) never
   receives a snapshot, `setSlotsReady` never fires, and the skeleton spins
   forever where `runBootstrap`'s `catch` (`:45`) cannot see it.
   ✔ `firebase@12.17.1` exports `initializeFirestore`, `persistentLocalCache`,
   `persistentMultipleTabManager`, `memoryLocalCache` and `waitForPendingWrites`.
   Call `initializeFirestore(app, { localCache: persistentLocalCache({
   tabManager: persistentMultipleTabManager() }) })` **inside a try/catch that
   falls back to `memoryLocalCache`** and sets a store flag the UI surfaces as
   "changes won't survive a reload". Persistent cache rejects with
   `failed-precondition` on a lease conflict and throws outright in Safari
   private mode / Firefox ETP; at module scope that white-screens the app.
   ✔ This constrains placement: `firebase.ts:24,47` call `getFirestore()` with no
   args and `initializeFirestore` must run first, so it belongs in the **forked
   `services/firebase.ts`**, not the platform re-export file.
2. **`writeBatch.commit()` — and `deleteDoc` — resolve on server ack**, not on
   local-cache apply. `await Promise.all(commits)` at `accountLinkService.ts:143`
   and `:216` (which also contains the `deleteDoc` at `:141`) returns immediately
   on RNFB and **hangs offline** on the JS SDK, while queued deletes sit in
   IndexedDB and flush on the next page load even though the merge was abandoned.
   Guard with `waitForPendingWrites()` + a timeout, and refuse to start a merge
   while `navigator.onLine === false`.
3. **First snapshots can be `fromCache`.** `readExistingIds` (`:149-171`) treats
   the first `onSnapshot` result as authoritative. An empty `fromCache: true`
   snapshot means `resolveMergeWrites` sees zero collisions and `batch.set(…)`
   (`:197`) **overwrites real documents in the target account**. Gate on
   `metadata.fromCache === false` — **and pass `{ includeMetadataChanges: true }`**,
   or a cache→server transition with no document delta raises no event and the
   promise never resolves.
4. **`getDocs(…, { source: "server" })` does not exist in v12.** ✔ `getDocs`
   takes only a `Query` (`index.d.ts:1424`); the v12 API is `getDocsFromServer`
   (`:1439`). An earlier draft leaked compat/v8 syntax here.

### What web does not do (graceful degradation)

Hidden with a clear reason, not half-implemented: rain notifications, the daily
digest and the "Check your alerts" card, calendar import/export, the iOS widget,
OTA updates and `UpdateBanner`, haptics, the splash hand-off animation,
`localDataMigration`.

✔ This is safe for the settings document: `writeSettingsFields` uses
`{merge: true}` + `schemaVersion` (`settingsSync.ts:29-33`) and `DEFAULT_SETTINGS`
is the merge target (`settingsStore.ts:59-66`), so a web client that never
renders those cards never writes their fields. Keep `digestNotificationId`
excluded. **The rule that keeps it safe: web writes settings only through the
existing per-field setters (`settingsStore.ts:77-114`), never a bulk write** — ✔ a
bulk write via `toCloudSettingsFields` (`migrateSettingsDoc.ts:31-42`) would send
`undefined`s and clobber.

Two cross-client behaviours, one of which is a decision the plan previously left
too soft:

- **`hasSeenOnboarding`: web must not write it.** ✔ `index.tsx:90,104` set it
  only after the *notification* step, which web drops. A new web user would
  otherwise flip a cloud flag (`settingsStore.ts:65`) that suppresses the phone's
  location primer — the copy App Review litigated, per `UX.md`'s "Permission work
  is not done when it passes review here". Web either leaves the flag alone or
  uses a separate key.
- ✔ `account-link.tsx:182` gates "Continue with Apple" on `Platform.OS === "ios"`.
  Apple JS Sign In works on web, so that gate is revisited rather than ported.

### `UX.md` cross-check

Two open items are blocked on constraints that do not exist on web: the
collapsing header (CSS `position: sticky`; the tab-shift objection dies with a
sidebar) and duplicate-to-date's placement (blocked on Liquid Glass). Web can fix
both, so the apps diverge.

**Record that by amending the item in place, not by ticking it.** `UX.md`'s
convention is that a closed item is *deleted*, not ticked — and a web-only fix
closes nothing on mobile, so deleting would lose open work. Digest-time chips die
with notifications.

## Phase 4 — deploy

`apphosting.yaml` in `apps/web`, GitHub-triggered, behind the Hosting rewrite
described at the top — on `brelly.web.app`, not a custom domain.

### `/api/places` is a billed, public endpoint

✔ The proxy must cover exactly three outbound calls, no more:
`places:autocomplete` POST (`geocoding.ts:51`), `places/{placeId}` GET (`:94`),
and Geocoding `geocode/json` GET (`:186`).

Mandatory:

1. **Require a Firebase ID token** (`firebase-admin` `verifyIdToken`), and **be
   honest about what it buys**: anonymous sign-up is open to anyone with the
   public web API key, so an attacker mints unlimited uids and any per-uid limit
   falls to rotation. This raises the floor; it is not the control.
2. **Rate-limit per-IP and per-uid.** The per-IP limit is the real control. State
   is **not** in-process — App Hosting is multi-instance Cloud Run, so counters
   reset on scale-out and cold start; use Firestore or Redis. Read the client IP
   from the correct end of `X-Forwarded-For`, since a client can prepend values.
3. **Validate input server-side**: `input` a string of length 2–200; `placeId`
   against `^[A-Za-z0-9_-]{1,255}$`; lat/lng finite and in range; the session
   token a well-formed UUIDv4 (not opaque passthrough of arbitrary text).
4. **Build the URL and the field mask server-side only.** ✔ The mask is currently
   client-set at `geocoding.ts:102-103` and is the Essentials-SKU boundary — never
   forward a client `X-Goog-FieldMask`, and never accept a client-supplied path or
   base URL, which would make the route an SSRF gateway to every API the key
   enables.
5. **`Cache-Control: no-store`** on all three responses (per-user and billed, so
   no CDN edge caching), and an `Origin` allowlist as a cheap filter — not a
   defence against non-browser clients.
6. **Do not forward Google's error bodies.** `geocoding.ts:75,107,189` throw on
   `!res.ok`; `REQUEST_DENIED`/quota text and project identifiers must not reach
   the browser. Map to opaque codes, log detail server-side. Related:
   `reverseGeocode` returns `null` for a *denied key* (`:195`) — a silent,
   indistinguishable failure the proxy should surface as a 5xx.

Back it with a Cloud budget alert and a Places API quota cap. **App Check is a
Phase 4 gate, not a follow-up** (see below) — it is the only control that
distinguishes the real app from a `fetch` loop.

**The session token stays per typing session, and moves to the browser.**
✔ `geocoding.ts:31` is a module-level `currentSessionToken`, minted at `:35`
(`Math.random().toString(36) + Date.now()` — not a UUID, and not a CSPRNG) and
cleared at `:113`. Correct in a single-user RN runtime, wrong in a shared server
process. But *per-request* is also wrong: every keystroke would bill as its own
session. Mint it in the browser per typing session and forward it as a validated
UUID. Be clear-eyed that this is a **correctness** fix, not a billing control — a
hostile client sends a fresh UUID per request regardless; the rate limit, plus a
cap on distinct tokens per uid per minute, is what bounds the bill.
✔ `reverseGeocode` correctly takes no session token.

⚠ **`crypto.randomUUID()` is not available on this runtime** — no polyfill in
`node_modules/expo/src/winter/`, none in RN 0.86/Hermes, and `expo-crypto` is not
a dependency. "Switch mobile to `crypto.randomUUID()`" would ship an
undefined-is-not-a-function crash. Add `expo-crypto` and put `randomUUID()`
behind `@brelly/platform/random`.

**Two Places keys.** An app-restricted key cannot authenticate from Cloud Run, so
the route needs its own server-only key (Secret Manager,
`availability: [RUNTIME]`, never `BUILD`, never `NEXT_PUBLIC_`).

**Say plainly what the proxy does not buy.** ✔ `geocoding.ts:3` reads
`EXPO_PUBLIC_GOOGLE_PLACES_KEY`, a literal substitution — that key already ships
inside every IPA and APK and is recoverable with `strings`. The proxy protects the
*web* key only. Independent of this migration: restrict the mobile key by iOS
bundle ID + Android package/SHA-1 and to Places API (New) + Geocoding only, and
rotate it if it is currently unrestricted.

### Firestore rules and App Check

A public web origin changes the economics of abuse: on mobile an attacker needed a
built app; on web a `fetch` loop will do.

- **The rules validate field *values* but never the field *set*.** ✔ `isValidSlot`
  (`firestore.rules:20`), `isValidRoutine` (`:40`) and `isValidSettings` (`:64`)
  check known keys only, so a client can attach arbitrary fields up to 1 MiB.
  Add `request.resource.data.keys().hasOnly([…])` — **but not the lists implied by
  the rules' own key names, which would reject every write**. ✔ Slot documents
  also carry `id` and `date` (`itinerarySync.ts:84` writes
  `toCloudDoc({...slot, date})`); routine documents carry `id`, `frequency` and
  `dayOfMonth` (`types/routine.ts:31,45`), none of them named in `isValidRoutine`.
  Settings is the six `DEFAULT_SETTINGS` keys plus `schemaVersion`
  (`settingsSync.ts:31` writes it every time). Note `hasOnly` on a merge write
  evaluates the *resulting* document, so any legacy field on a production
  document becomes an update failure — **audit production documents before
  enabling**. Add an unknown-field case per collection to the 24 emulator tests.
- ✔ **There is no App Check anywhere** (zero hits across `src`, `.github`,
  `app.json`, `firebase.json`, `firestore.rules`). Enable it — reCAPTCHA
  Enterprise for web, App Attest / Play Integrity for mobile — enforced on
  Firestore and as a second gate on `/api/places`.

⚠ **Do not "fix" slot `startTime`/`endTime` with `isTimeOfDay`.** An earlier
draft proposed tightening `firestore.rules:27-28` (`size() > 0`) to match routines
(`:46-47`). ✔ That would reject every slot write: slot times are **ISO
datetimes** — `routineOccurrences.ts:121` writes `start.toISOString()`, and
`planSelectors.ts:34,82,124` and `detectScheduleConflicts.ts:73` all do
`new Date(slot.startTime)`. Only *routines* use `toTimeOfDay`
(`routineOccurrences.ts:157`). The emulator fixture `validSlot`
(`firestoreRules.emulator.test.ts:30-31`) uses `"09:00"` and is unrepresentative —
which is exactly why the inconsistency looked cosmetic. Either drop this item or
tighten with an ISO-8601 regex and fix the fixture.

### Concurrent writes

✔ Zero uses of `serverTimestamp` in the sync layer, so there is no ordering
field. Field-level `{merge: true}` means most concurrent edits survive, but a slot
edited on both clients at once resolves per-field with no user-visible signal.
Accepted; record it in `NOTES.md` so it is not rediscovered as a bug.

---

## Tooling

**Jest: one config per workspace, run with cwd inside it. Not a root `projects`
array.** ✔ `withTypescriptMapping.js:59` calls `path.resolve('tsconfig.json')` —
cwd-relative — and `jest-preset.js:44` calls `resolveBabelOptions(process.cwd())`.

Lead with the leg that actually holds, because the others do not. The
tsconfig-mapping problem is **defeatable** by writing `moduleNameMapper`
explicitly per project. The babel leg is weak here: there is no
`babel.config.js`, so `resolveBabelOptions` falls through to
`require.resolve('expo/internal/babel-preset', …)`, which resolves from the
hoisted root either way. ✔ The load-bearing leg is **`coverageThreshold`
resolving path keys against `process.cwd()`** (`CoverageReporter.js:350`), which
no per-project config can work around.

An earlier draft supported this with a fabricated claim — "exactly two tests fail
(`appTabs`, `animatedIcon`)". ✔ There are no tests for either file. Separately,
✔ the `@/assets/*` mapping is **already broken today**: `--showConfig` orders
`^@/(.*)$` before `^@/assets/(.*)$`, so the general alias shadows it and
`src/assets/` does not exist. File that as its own pre-existing bug.

Root scripts **enumerate workspaces explicitly** — `yarn workspace @brelly/core test`,
etc. ✔ Not `yarn workspaces run`, which on 1.22.22 aborts in the first workspace
missing the script, and `apps/web` has no `test:coverage` until Phase 3 by design.
(✔ `yarn workspace <n> <s>` does cd into the package directory, so the cwd
requirement above holds.)

`__mocks__` needs no special handling: Jest's manual-mock discovery is
`roots`-based, so `git mv __mocks__ apps/mobile/__mocks__` is the whole fix and
the `<rootDir>/__mocks__/styleMock.js` mapping retargets with it. `packages/core`
needs none of the three mocks — a useful independent check that the boundary held.

**Coverage: three independent gates, no merging.** ✔ Not a preference —
**coverage does not cross a `rootDir` boundary**, measured in Phase 2. With
`../../packages/core/src/**` in `apps/mobile`'s `collectCoverageFrom`,
`shouldInstrument` returns `true` for a core file, the module loads and
executes, and it still never reaches the coverage map; the threshold group then
fails `Coverage data ... was not found`. (Merging a React Native app and a
Next.js app would be arithmetic without meaning anyway.)

⚠ The number this section gave for core was wrong, and the correction is the
useful part. "Core is pure functions with structural seams, so raise it to
95/90/95/95" ✔ measured **81/85/79/82**: the five sync services live in core but
their tests live in `apps/mobile`, because they exercise the mobile bindings
(`accountLinkService.test.ts` imports `expo-notifications` and
`@/store/mmkvStorage`) and cannot move. ✔ Exclude those five, plus `types/` and
the `export *` barrel, and core's own suite measures **98.5/94.4/98.5/99.1** —
so 95/90/95/95 holds after all, over the files the suite can actually reach.
State the hole that leaves: a new core sync service is behind no coverage
threshold in either workspace.

Mobile keeps 90/85/90/90, ✔ measured 93.3/89.6/92.0/94.4 over `src/**` alone.
`apps/web` gets no config and no threshold until it has real code.

✔ Core's tests still run **twice**, as they did under the pre-monorepo root
config: a `roots` entry in `apps/mobile/jest.config.js` keeps them in the mobile
pass, where `@brelly/platform/*` resolves to the Expo implementations. Without
it the "core works on a phone" half of the seam check is silently lost.

**TypeScript: path mappings, one project per app. Not project references.**
References need `composite: true`, which needs core to typecheck in isolation,
which reintroduces the contract file the boundary design avoids. Compiling core
twice, once per app, *is* the drift detector. **No root `tsconfig.json`** — a
`files: []` stub would let `tsc --noEmit` succeed while checking nothing.

State the consequence accurately. ✔ `app.config.js`, `jest.setup.js` and
`plugins/*.js` are **already** in no program today (the `include` globs only
`**/*.ts(x)`), so nothing is lost there. The genuine new loss is
`tests/firestore-rules/*.ts`, which *is* typechecked today. Put that in `NOTES.md`
rather than the vaguer claim an earlier draft made.

**ESLint: one root flat config**, using `defineConfig`'s `extends` inside
`files`-scoped blocks. ✔ Verified on the installed eslint 9.39.5, including
`eslint-config-expo/flat`'s bare global-ignores element (index 9) — it does not
throw. Two traps an earlier draft walked into, plus the remedy that actually
works:

1. **The `packages/core` block needs a TypeScript parser.** ✔ Reproduced: with
   expo scoped to `apps/mobile/**` and a rules-only core block, every core `.ts`
   returns `Parsing error: Unexpected token {` and the boundary rule silently
   never runs. ✔ `eslint-config-expo/flat` element 7 is the parser source.
   ⚠ Of the two remedies an earlier draft offered, **only one works today**:
   "extend a shared TS base" has nothing to extend
   (`require.resolve('typescript-eslint')` → MODULE_NOT_FOUND; only
   `@typescript-eslint/parser` is hoisted transitively). So: **put
   `packages/core/**` in the expo block's `files`.** ✔ Verified end to end —
   parser correct, boundary rule fires.
2. **`no-restricted-imports` flags type-only imports**, ✔ reproduced, and core has
   one (`accountLinkService.ts:1`). Re-export the type through
   `@brelly/platform/auth` — ✔ that satisfies the rule trivially, and is a real
   boundary rather than an `allowTypeImports` exception.

✔ Two more things break the moment the expo block is scoped, neither foreseen
here, both found in Phase 2:

- `eslint-import-resolver-typescript` looks for `tsconfig.json` beside the cwd,
  and there is no root one any more — so every `@/…` import in `apps/mobile`
  reports `import/no-unresolved`. The block needs
  `settings: { "import/resolver": { typescript: { project: ["apps/mobile/tsconfig.json"] }, node: { extensions: [...] } } }`,
  and **both** resolvers have to be restated: flat config replaces
  `import/resolver` wholesale rather than merging into what `expoConfig` set.
- the same rule then fires on `@brelly/platform/*` in core, which is correct
  behaviour and the wrong answer — no package provides those specifiers, by
  design. The core block needs
  `"import/no-unresolved": ["error", { ignore: ["^@brelly/platform/"] }]`.

`eslint-config-next` is still eslintrc-shaped in Next 15, so it needs `FlatCompat`.

**The boundary rule's group list has holes**, and ⚠ the replacement offered
below has a worse one. ✔ `react-native/*` does **not** match `react-native-*`,
so `react-native-mmkv`, `react-native-reanimated`, `react-native-safe-area-context`
and `@bacons/apple-targets` all pass — and `mmkvStorage.ts` is exactly the file
this exists to catch.

⚠ But these patterns are **gitignore syntax, not minimatch**: ESLint 9 matches
them with the `ignore` package, where an unanchored pattern matches any path
*segment*. So the bare `firebase` below matches `@brelly/platform/firebase` —
the seam the rule exists to send people to — and `react-native` matches
`@testing-library/react-native`. ✔ Anchor every entry with a leading slash, and
keep `react-native-*` separate from `/react-native/**` for the original reason.

```js
{ files: ["packages/core/**/*.{ts,tsx}"],
  rules: { "no-restricted-imports": ["error", { patterns: [{
    group: ["/react-native", "/react-native/**", "/react-native-*",
            "/expo", "/expo-*", "/@expo/**", "/@bacons/**",
            "/@react-native-firebase/**", "/@react-native-google-signin/**",
            "/firebase", "/firebase/**", "/next", "/next/**", "/@/**"],
    message: "packages/core is platform-free: go through @brelly/platform/* (behaviour) or configureCore() (values).",
  }]}] }}
```

✔ Note that scoping `expoConfig` under `files` demotes its global
`ignores: ["android/app/build"]` to a scoped one. Harmless while `/android` is
gitignored; worth knowing before someone unignores it.

**CI (`ci.yml`): one job, named steps, no matrix.** A matrix duplicates
`yarn install` per leg and loses which leg broke in the Telegram message.
Changes: the `expo-env.d.ts` printf writes to `apps/mobile/expo-env.d.ts`;
typecheck splits into two named steps; **two** `yarn workspace <name> test:coverage`
steps in c2.3 — ⚠ not three, because `apps/web` does not exist until Phase 3 and
the third step would fail "Unknown workspace" for all of Phase 2. The web step
arrives with the first web route.

Plus a stray-lockfile guard, which needs **both** commands. ✔ The `--ignored`
form catches untracked files but prints nothing for a *committed*
`apps/web/yarn.lock`, and CI checks out clean — so on its own it passes on
exactly the case that breaks `--frozen-lockfile` permanently:

```
git ls-files -- 'apps/*/yarn.lock' 'apps/*/package-lock.json' \
                'apps/*/pnpm-lock.yaml' 'apps/*/bun.lock'
git status --porcelain --ignored -- 'apps/*/yarn.lock' 'apps/*/package-lock.json' \
                'apps/*/pnpm-lock.yaml' 'apps/*/bun.lock'
```

Both must be empty. The `conventions` and `notify` jobs need no edits.

**`ios-release.yml` / `ota-update.yml`:** ✔ the plist decodes to
`apps/mobile/GoogleService-Info.plist` — required, since `ios-release.yml:82` and
`ota-update.yml:77` both `base64 -d > GoogleService-Info.plist` at the checkout
root and `app.json:24` is `./GoogleService-Info.plist` relative to the Expo
project root. Every `eas` step gets `working-directory: apps/mobile`.
`yarn install --frozen-lockfile` stays at the repo root. ✔ Also repoint
`ios-release.yml:66-70`'s reproduce recipe (`git archive` →
`npx expo config --type introspect`), which still assumes the checkout root.

✔ Moving the plist does **not** change the fingerprint: `Expo.js:195` sets
`overrideHashKey = 'expoConfigExternalFile:contentsOnly'` and
`postUpdateExpoConfig` deletes `ios.googleServicesFile` from the hashed config.

⚠ **Do not add an `.easignore`.** An earlier draft placed one in `apps/mobile`.
None exists today, so it would be a *new* hashed source that bumps the fingerprint
— and since EAS archives from the VCS root, a file at the Expo project root has no
effect on what gets uploaded, which is the file's entire purpose. If one is wanted
later, state which property it buys first. **[unverified — eas-cli not installed
locally]**

## The fingerprint / OTA hazard

**Rewritten twice.** An earlier draft claimed the `packageJson` sourcer hashes
dependencies. ✔ It does not: `@expo/fingerprint`'s
`build/sourcer/Bare.js:45-68` (`getPackageJsonScriptSourcesAsync`) reads **only
`packageJson.scripts`**, `Sourcer.js:29-47` lists 15 sourcers and none reads
`dependencies`, and the live source list for this repo contains
`contents packageJson:scripts` with no dependency entry.

Measured facts (hashes are machine-local; **re-measure, do not copy**):

- ✔ **Every Phase 0 commit bumps the hash**, because all three change `scripts`
  values. Reproduced: baseline `e66760cc74ffb…` → `4bcbf2268892…` after adding
  two scripts.
- ✔ **c1.1's `@brelly/core` dependency is invisible** to the fingerprint.
- ✔ **`.gitignore` is a hashed source** (`Bare.js:70-80`; `Options.js:71` sets
  `DEFAULT_SOURCE_SKIPS` to `PackageJsonAndroidAndIosScriptsIfNotContainRun`, so
  `SourceSkips.GitIgnore` is **off**). Reproduced: appending `.next/` →
  `eb03c97eade8…`.
  ⚠ Which `.gitignore`, though — `getGitIgnoreSourcesAsync` reads
  `<projectRoot>/.gitignore`, so from Phase 2 on it is **`apps/mobile/.gitignore`**
  and the root one is not hashed at all. That file did not exist before the
  move; expo-cli generates it, and the sourcer contributes nothing when it is
  absent. ✔ Measured: `5643fd7c…` present, `4703a201…` absent. It has to be
  **committed**, or a developer machine that has run `expo start` hashes it and
  a fresh CI checkout does not — and the two compute different runtime
  versions. Unrelated to the ignore *rules*, which still come from the root
  file via `git check-ignore` at the VCS root.
- ✔ **Phase 2 bumps the hash unconditionally**, and an earlier draft filed the
  reason under Phase 3 as a conditional. `Hash.js:32` hashes
  `createSourceId(source)` = `filePath`, and autolinking `sourceDir`s are
  `path.relative(projectRoot, …)` — so all ~150 `dir node_modules/…` sources gain
  `../../` and the `expoAutolinkingConfig` contents change with them. Guaranteed.
- ✔ **Keeping `ios/` and `android/` git-ignored is load-bearing for a reason the
  earlier draft never stated.** `ProjectWorkflow.resolveProjectWorkflowAsync`
  flips managed→generic if `ios/` is not ignored, and then does *not* add
  `ios/**/*` to the ignore paths — so the entire generated tree, `Pods/` and
  `build/` included, gets hashed. Measured: removing `/ios`+`/android` →
  `6713119fa4a9…`, with the `ios` dir hash going from `null` to `d5428c11…`. The
  practical consequence is local-vs-CI hash divergence.
  ✔ `isFileIgnoredAsync` shells `git check-ignore` from the **VCS root**, so a
  root rule `/apps/mobile/ios` satisfies this exactly as well as a sub-file would.
- ✔ **`Packages.js` risk is smaller than stated**: `react-native` is hashed
  `packageJsonOnly` as *contents*, not path, so re-hoisting alone cannot move it —
  only a version change can.

Revised procedure:

1. **Before c0.1** — `git tag ota-baseline-pre-monorepo` and push it. Shipped
   builds keep their runtime version, but `main` will no longer be able to
   *produce* that fingerprint. The tag makes an emergency hotfix a checkout.
2. Cut `production` and `preview` native builds **now**, at the pre-Phase-0 hash.
3. Label each Phase 0 commit build-forcing and run
   `eas fingerprint:generate --platform ios --environment production` after the
   phase. Build again if OTA needs to stay open through Phase 1.
4. Phase 1 is *expected* to be fingerprint-neutral **[unverified]** — `app.json`,
   `app.config.js`, `plugins/` and `expo-build-properties` never move, and
   dependencies are not hashed. **Measure it**, for the same reason this section
   needed rewriting twice.
5. Add a **soft** fingerprint-diff annotation to `ci.yml` on PRs (gated on
   `head.repo.full_name == github.repository`, since it needs `EXPO_TOKEN`).
6. Land Phase 2 as one PR and run *iOS Release* for both profiles on merge. The
   hash **will** have moved. OTA is frozen until both finish; the existing guard
   enforcing that is correct.
7. Phase 3 changes `.gitignore`, so re-check there too. The `yarn why` check below
   guards the hoisting case.

`eas fingerprint:compare --build-id <ID> --environment production` names the exact
source when something moves unexpectedly.

Two `NOTES.md` lines, both pre-existing and unrelated to this work:
✔ `targets/widget/index.swift` is in **no** fingerprint source, so widget Swift
edits never bump the runtime version; and ✔ `app.json:40`'s
`android.adaptiveIcon.monochromeImage` is absent from the asset sources although
the file exists.

---

## Verification

Run `yarn verify:fast` at the repo root after **every** structural commit — that
is also what the Stop hook runs, so a red tree blocks the next turn.

- **c0.1** — the 172 baseline `eslint .` errors go to 0, including the two
  `react/display-name`, with no `eslint-disable` added to source files.
- **c1.1** — a stub test inside `packages/core` runs and its `.ts` transforms.
  Catches the `transformIgnorePatterns` / symlink-realpath risk when nothing is at
  stake. Symptom if it bites: `SyntaxError: Cannot use import statement outside a
  module` pointing at a core file.
- **c1.9–c1.11** — no test file moves, no assertion changes; the only test diff is
  import specifiers.
- **c1.14** — `yarn typecheck` fails by name on any import still reaching into
  core through the old alias. This is the extraction's proof.
- **ESLint scoping** — four checks, because an earlier draft's two would have
  passed while the boundary rule was dead:
  ```
  npx eslint --print-config apps/web/src/app/page.tsx \
    | jq '.rules | keys | map(select(startswith("react-native")))'          # []
  # ⚠ this check was fabricated and always prints 0: `eslint-config-expo/flat`
  # contains NO `react-native/*` rules. Count all rules instead — 84 on a
  # mobile or core file, 0 on a web one.
  npx eslint --print-config apps/mobile/src/app/_layout.tsx \
    | jq '.rules | keys | length'                                           # 84
  npx eslint --print-config packages/core/src/services/weather.ts \
    | jq '.languageOptions.parser'   # "typescript-eslint/parser@…", NOT "espree@…"
  npx eslint packages/core --max-warnings 0        # must not report "Parsing error"
  ```
  ✔ The parser check discriminates: broken prints `"espree@10.4.0"`, working
  prints `"typescript-eslint/parser@8.65.0"`. (It is never `null`, so check for
  espree, not for null.) Add a fifth: a scratch file in core importing
  `react-native-mmkv` must be flagged.
- **After c2.1** — `cd apps/mobile && yarn test`, and grep the output for
  `react-native-reanimated` (the `__mocks__` failure is loud, not silent). Never
  invoke jest for the mobile workspace from the repo root. Confirm
  `apps/mobile/.env` and `apps/mobile/GoogleService-Info.plist` exist — they are
  gitignored, so nothing else will tell you. Confirm no `ios/`, `android/` or
  `coverage/` remains at the repo root.
- **After c2.2** — `cd apps/mobile && npx expo prebuild --clean && git status --porcelain`
  must be empty. **This, not `expo config --type introspect`, is the gate.** ✔ An
  earlier draft claimed introspect evaluates all three local plugins; it does not.
  `withIntrospectionBaseMods` deletes every non-introspective mod
  (`node_modules/@expo/config-plugins/build/plugins/mod-compiler.js:99`), and a
  `DEBUG='expo:config-plugins*'` run shows exactly that — all three local plugins
  are `withDangerousMod` ×2 (`withExpoUiReactHeaderFix.js:78`,
  `withFirebaseSpmPostIntegrate.js:212`) and `withXcodeProject`
  (`withExplicitModulesDisabled.js:29`), and `@bacons/apple-targets` widget
  generation is skipped too. Introspect proves the config *evaluates* (keep it for
  the ENOENT case in `ios-release.yml`) and nothing about anchors. ✔ All three
  anchor assertions verified against the live `ios/`:
  ```
  grep -c 'name = "\[RNFB\]' apps/mobile/ios/brelly.xcodeproj/project.pbxproj  # 2
  grep -q 'React-VFS.yaml' apps/mobile/ios/Podfile            # Podfile:73
  grep -q 'BRELLY_EMBED_DYLIBS_ONLY' apps/mobile/ios/Podfile  # Podfile:101
  ```
  And check ✔ `targets/widget/expo-target.config.js:27`'s
  `icon: "../../assets/icon/light-hook.png"` by hand — it survives only because
  `assets/` moves with mobile, and introspect will not tell you.
- **After the Phase 3 install** — `yarn why react && yarn why react-dom && yarn why react-native`,
  each reporting exactly one root-level version. Yarn 1 hoisting duplicating React
  shows up as `Invalid hook call` on web and a red screen on mobile.
- **Web offline durability** — a unit test asserting `initializeFirestore` got a
  `localCache` option, **plus** one asserting the `memoryLocalCache` fallback sets
  the degraded flag when the persistent cache throws. Then reproduce by hand with
  DevTools offline + reload, and once in Safari private mode.
- **Web auth** — sign-in tested in Safari with "Prevent cross-site tracking" on,
  on `brelly.web.app`, through the Hosting rewrite. Gates Phase 4. Check
  the page's origin and `authDomain` are the same string before blaming
  anything else: that identity is the entire mechanism.
- **`/api/places`** — an unauthenticated request returns 401; a request with a
  client-supplied `X-Goog-FieldMask` is ignored, not forwarded; a Google error
  body does not appear in the response.
- **`yarn test:emulator`** green from the root after the move, including the new
  unknown-field cases and an audit that no production document carries a field
  outside the `hasOnly` lists.
- **The failed merge restores everything** — the gate for the pre-switch read
  above. Seed 40 slots and 5 routines under an anonymous uid, leave the Zustand
  stores empty (do not attach listeners), run the email merge with a wrong
  password. Assert: the rejection surfaces, and both collections hold exactly
  the original document **ids** afterwards — ids, not counts, or a fresh-id
  regression passes. Run it in the emulator, where the rules that make the
  ordering load-bearing are actually enforced. Then repeat with the password
  correct and confirm the same ids land in the target account.
- **The interrupted merge restores on the next launch** — the gate for fix 2.
  Same seed, choose **"Don't add"**, and kill the process between the delete
  and the identity switch (mock `signInWithLinkedCredential` to hang). Relaunch
  still anonymous: assert all 45 documents are back under the original ids and
  the pending key is cleared. Repeat with **"Add"** and the switch completed, and
  assert the record is cleared *without* writing the 45 into the target account
  — the `addLocalData: false` half of the record is what stops that, and a test
  that only covers the "Add" path will not notice it missing.
- **The prompt reflects Firestore, not the store** — the gate for fix 3. With
  40 slots in Firestore and empty stores, assert `promptMergeChoice` is called
  with `(40, 5)` and that the `snapshot.isEmpty` branch at `account-link.tsx:68`
  is **not** taken. This is the one that fails silently in production: no error,
  no toast, just data gone.
- **End to end**: `yarn workspace @brelly/web dev`, sign in anonymously, add a plan
  on web, confirm it on the phone against the same account, edit it on the phone
  and watch the web list update through `onSnapshot`. Then the merge path:
  anonymous data on web → sign in to an existing account → the data arrives,
  nothing in the target account is lost, and the anonymous uid's documents are
  actually gone (not orphaned).

## Docs to update as work lands

Per `AGENTS.md`: move finished work from `PLAN.md` into `NOTES.md` with the round
history. For `UX.md`, **amend the diverging items in place** — the convention is
delete-when-closed, and a web-only fix closes nothing on mobile.

Add to `AGENTS.md`: the **alias for behaviour, inject for values** rule and the
`packages/core` boundary.

Add to `NOTES.md`'s "read this before writing code here":

- **the merge order in `accountLinkService` is load-bearing** — `isOwner(uid)`
  means the anonymous documents can only be deleted *before* the identity switch;
- the jest-expo cwd trap, and that the `coverageThreshold` cwd resolution is the
  leg that actually rules out a root `projects` array;
- the already-broken `@/assets` mapper ordering;
- the anchored-gitignore trap, and that keeping `ios/`/`android/` ignored is what
  holds the project in the *managed* workflow for fingerprinting;
- that the fingerprint hashes `package.json` **scripts**, not dependencies — a
  script rename freezes OTA;
- ✔ that **no `metro.config.js` is needed**: `@expo/metro-config` 57.0.9
  auto-detects the workspace (`getWatchFolders.js`, `getModulesPaths.js:12-19`).
  Record it so nobody "fixes" it. There is no `babel.config.js` either;
- that `targets/widget/index.swift` and `android.adaptiveIcon.monochromeImage` are
  not fingerprint sources;
- that the sync layer has no `serverTimestamp` ordering field, so concurrent
  cross-client edits resolve per-field, last-write-wins;
- that `tests/firestore-rules/*.ts` loses typechecking when the root
  `tsconfig.json` goes away.
