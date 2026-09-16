/**
 * TypeScript 6 refuses a side-effect import with no declaration behind it
 * (TS2882), and Next only declares `*.module.css`. `src/app/globals.css` is
 * imported for its side effect from the root layout, which is the one place
 * Next allows a global stylesheet, so the declaration has to come from here.
 *
 * The mobile app gets the equivalent from `expo/types` via `expo-env.d.ts`.
 */
declare module "*.css";
