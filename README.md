# Brelly ☔

Brelly is a weather-aware itinerary planner. Add stops to your day with a
place and a time, and Brelly tells you whether to bring an umbrella — in
Singapore via `data.gov.sg` NEA forecasts and live conditions, and anywhere
else in the world via Open-Meteo.

## Features

- **Plans** — Google Places autocomplete for locations, one date + two time
  fields per stop, gap/overlap conflict warnings, dry-window suggestions, and
  an auto-generated packing list based on the forecast.
- **Weather** — NEA nowcast/24hr/4-day forecasts and live rainfall/temperature/
  wind/PSI/UV readings for Singapore stops; Open-Meteo forecasts for stops
  anywhere else, translated into the same vocabulary and icons.
- **Routines** — repeat a stop across chosen weekdays; occurrences are
  materialised as ordinary slots on a rolling two-week horizon, with per-day
  edit/detach support.
- **Notifications** — rain alerts scheduled ahead of each stop, kept in sync
  with the forecast on every launch and foreground, plus a daily digest.
- **History** — finished stops move to their own tab rather than disappearing
  or cluttering what's ahead.
- **Cloud sync & accounts** — itinerary, routines, and settings live in
  Firestore behind anonymous auth, with optional linking to Google, Apple, or
  email/password to back up and carry data across devices.
- **Backup** — export/import your itinerary and routines as a JSON file.

## Tech stack

[Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction),
React Native, TypeScript, Zustand, Firebase (Auth + Firestore), TanStack Query.

## Getting started

```bash
yarn install
```

Brelly needs a few things configured before it runs:

- An `.env` with `EXPO_PUBLIC_GOOGLE_PLACES_KEY` (Places autocomplete/details)
  and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Google sign-in).
- Firebase config files: `GoogleService-Info.plist` (iOS) and
  `google-services.json` (Android).

Then, for a native build:

```bash
npx expo prebuild
yarn ios      # or: yarn android
```

Or to run in Expo Go / web:

```bash
yarn start
```

## Scripts

| Command | Description |
| --- | --- |
| `yarn start` | Start the Expo dev server |
| `yarn ios` / `yarn android` | Build and run natively |
| `yarn web` | Run in the browser |
| `yarn lint` | ESLint, zero warnings allowed |
| `yarn test` | Jest test suite |
| `yarn test:emulator` | Firestore rules tests against the Firebase emulator |

Before shipping, all three of `npx tsc --noEmit`, `yarn lint`, and `yarn test`
must be clean.

## Project docs

- [`AGENTS.md`](AGENTS.md) — conventions for working in this repo (branch
  naming, Expo version notes, doc-keeping rules).
- [`PLAN.md`](PLAN.md) — the open task list.
- [`NOTES.md`](NOTES.md) — engineering traps and round-by-round build history.
- [`UX.md`](UX.md) — open UX issues and their status.
