---
name: zustand-tanstack-conventions
description: Conventions for how Zustand (client/UI state) and TanStack Query (server/async state) divide responsibilities in Brelly, a React Native/Expo app. Use this whenever adding new state, deciding whether something belongs in a Zustand store vs. a Query hook, writing query keys or cache invalidation logic, or touching the Firestore sync layer that persists store state. Prevents the common anti-pattern of duplicating fetched data into Zustand or hand-rolling fetch/loading state that TanStack Query already solves.
---

# Zustand + TanStack Query Conventions

The core rule: **Zustand owns client/UI state, TanStack Query owns anything
that came from a network request.** Don't copy query data into a store "just
in case" — it desyncs from the cache and you lose retry and invalidation.

## What goes in Zustand

Stores live in `src/store/`, one file per store, named `xxxStore.ts`
exporting `useXxxStore`.

- User-authored data: the itinerary (`itineraryStore`), routines
  (`routineStore`). Authored locally, then mirrored to Firestore — see below.
- Preferences: theme, rain alert lead time, quiet hours, digest
  (`settingsStore`).
- Ephemeral UI state: toasts (`toastStore`), sync/bootstrap status
  (`cloudSyncStore`).

Not: forecast responses, place results, air quality — anything fetched.

Stores are plain `create<State>()((set, get) => …)`. **No middleware.** There
is no `persist`, no `devtools`, no `immer` in this codebase; adding one is a
new pattern, so raise it rather than slipping it into a store.

## What goes in TanStack Query

Query hooks live in `src/hooks/`, **not** a `queries/` folder, and are named
for what they return — `useLiveConditions`, `useNearbyForecast`, `useUvIndex`,
`useWeatherForSlot`, `usePlaceSearch`. There is no `Query` suffix; don't
introduce one.

Each hook wraps a client from `src/services/` and owns its `staleTime`.

## Query keys

Keys are inline literal arrays, with a **domain string first**:

```ts
queryKey: ["liveConditions", latitude, longitude]
queryKey: ["nearbyForecast", region, hours]
queryKey: ["weather", provider, region, latitude, longitude, slotStartTime]
```

There is no key factory and no `keys.ts`. That first element is load-bearing:
[useWeatherRefresh.ts](src/hooks/useWeatherRefresh.ts) selects queries to
refetch by matching `queryKey[0]` against `["weather", "nearbyForecast",
"liveConditions", "airQuality"]`. A new weather query must use one of those
prefixes or add itself to that list, or pull-to-refresh will silently skip it.

## staleTime

The `QueryClient` in [src/app/_layout.tsx](src/app/_layout.tsx) sets a 10
minute default with `retry: 2`. Override per hook to match how fast the real
data moves, and say why in a comment:

- forecasts — 10 min (the default)
- live sensor readings — 5 min (`useLiveConditions`)
- UV index — 1 hour (NEA republishes hourly)

## Refresh and invalidation

- New itinerary stop → don't invalidate. A different area is a different key,
  so it fetches on its own.
- Pull-to-refresh → use `useWeatherRefresh`. It calls `refetchQueries` with a
  prefix predicate, not `invalidateQueries` — with a 10 minute `staleTime` an
  invalidate can resolve from cache instantly and read as a broken gesture.
  Never blanket-invalidate with no key; it drags in place lookups too.
- Foreground after background → let Query's focus/reconnect defaults handle
  it. Don't hand-roll an AppState listener.

## Persistence

**Firestore is the persistence layer, not MMKV.** Store state reaches the
cloud through the `*Sync.ts` services in `src/services/` —
`itinerarySync`, `routinesSync`, `settingsSync` — and comes back through
`onSnapshot` listeners attached by
[cloudListeners.ts](src/services/cloudListeners.ts), which writes straight
into the stores. `useCloudBootstrap` mounts this once at the root.

Two rules that layer enforces:

- Device-local fields must never sync. `notificationId` and
  `notificationLeadMinutes` are stripped unconditionally on every write, in
  the sync module rather than at call sites.
- A listener failure must flip `cloudSyncStore`'s error state — otherwise the
  skeleton never resolves.

MMKV (`src/store/mmkvStorage.ts`) is used only for:

- the offline forecast cache ([forecastCache.ts](src/utils/forecastCache.ts),
  24-hour max age, read by `useWeatherForSlot`),
- one-time migration flags and the account-merge snapshot in
  `localDataMigration` / `accountLinkService`.

Those legacy MMKV keys are what `localDataMigration` reads to move
pre-Firestore data up; don't write new state to them.

## Anti-patterns

- `useEffect` + `useState` + manual `fetch`. If you're writing
  `isLoading`/`error`/`data` by hand, use `useQuery`.
- Syncing query `data` into a Zustand store via `useEffect`. Read from the
  hook where the data is needed.
- Adding a weather query whose `queryKey[0]` isn't in `WEATHER_QUERY_KEYS` —
  it won't refresh.
- Reaching for `persist` middleware. Persistence goes through the sync layer.
