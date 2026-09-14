/**
 * The values core needs that no module alias can supply.
 *
 * "Alias for behaviour, inject for values" is the boundary rule, and this is
 * the second half of it. The reason the split exists is not taste: `EXPO_PUBLIC_*`
 * and `NEXT_PUBLIC_*` are literal text substitutions performed by each app's
 * bundler at build time. `process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY` inside a
 * file that Next compiles is not a variable that resolves to nothing — it is a
 * string the Next bundler never rewrites, so nothing can make it work. The
 * value has to be handed in.
 */

/**
 * How core reaches Google's Places and Geocoding APIs.
 *
 * A discriminated union rather than `{ baseUrl, apiKey }` with the key
 * optional, and the difference is not cosmetic. An optional key means the web
 * app has to pass *some* key; `configureCore()` runs client-side there, so Next
 * would inline whatever it passed into the browser bundle — defeating the
 * `/api/places` proxy in the same commit that introduces it. Under a union
 * there is no `apiKey` field on the web arm to fill in wrongly.
 *
 * Two paths on the proxy arm, not one, because there are two upstream hosts
 * behind two different SKUs: Places (`places.googleapis.com/v1`, key in an
 * `X-Goog-Api-Key` header) and Geocoding (`maps.googleapis.com/maps/api/geocode/json`,
 * key as a query parameter). A single `baseUrl` cannot describe both.
 */
export type PlacesConfig =
  | { mode: "direct"; apiKey: string }
  | { mode: "proxy"; placesPath: string; geocodePath: string };

export type CoreConfig = {
  places: PlacesConfig;
};

let config: CoreConfig | null = null;

/**
 * Called once from each app's entry point, and from `jest.setup.js`.
 *
 * Deliberately throws rather than defaulting when read before it is called.
 * The behaviour being replaced was a module-scope `process.env.X!`, whose
 * non-null assertion turned a missing key into `undefined` interpolated into a
 * URL and a 400 from Google — a failure that pointed at the API rather than at
 * the build. Failing loudly at the seam is the whole gain.
 */
export function configureCore(next: CoreConfig): void {
  config = next;
}

export function getCoreConfig(): CoreConfig {
  if (!config) {
    throw new Error(
      "configureCore() has not been called — the app entry point must call it before any core module runs",
    );
  }
  return config;
}

/** Test-only, and for an app that reconfigures between sessions. */
export function resetCoreConfig(): void {
  config = null;
}
