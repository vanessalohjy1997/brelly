# Brelly ☔

Brelly shows Singapore weather (via `data.gov.sg` NEA APIs) for your planned
itinerary stops (via Google Places), so you know whether to bring an umbrella
before you head out.

Built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory.
This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Project docs

Read the relevant one before implementing — do not work from memory of them.

- [`PLAN.md`](PLAN.md) — the open task list and the verification gate
  (`npx tsc --noEmit`, `yarn lint`, `yarn test` must all be clean).
- [`NOTES.md`](NOTES.md) — the traps to read before writing code here, what is
  already built, and the round-by-round history of why.
- [`UX.md`](UX.md) — open UX issues with per-item status.

## Verification gate

Before checking off any task, and after every change:

```bash
npx tsc --noEmit
yarn lint
yarn test
```

All three must be clean — `yarn lint` runs with `--max-warnings 0`. All new
features must come with tests.

## Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow the guide on
  ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow the guide on
  ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in the guide on
  ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into
  advanced topics with the [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): a
  step-by-step tutorial where you'll create a project that runs on Android,
  iOS, and the web.
</content>
