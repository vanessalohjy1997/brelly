import "server-only";

/**
 * The Places proxy's rules, kept apart from the route handlers so they can be
 * asserted on directly.
 *
 * The proxy exists for one reason: a Places key is a billable credential with
 * no per-user scope, and the browser must never hold one. `NEXT_PUBLIC_*` is a
 * literal text substitution, so a key read that way would be *inlined into the
 * bundle* — which is why CI greps for one and why `PlacesConfig`'s web arm has
 * no `apiKey` field to fill in.
 *
 * What follows from that is the shape of this file. A proxy that forwards
 * whatever it is given is a public, unauthenticated, billed relay for the
 * entire Places API. So there is no passthrough: exactly three upstream calls
 * are reachable, each with its own validated inputs, and everything else is a
 * 404 before a key is ever read.
 */

const PLACES_BASE_URL = "https://places.googleapis.com/v1";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * Server-only, and deliberately not `NEXT_PUBLIC_`. Read at call time rather
 * than at module scope so a missing key is a 500 on one request instead of a
 * module that throws at import and takes the whole app's server bundle with it.
 */
export function placesApiKey(): string | null {
  return process.env.GOOGLE_PLACES_KEY?.trim() || null;
}

/**
 * The response body for anything that went wrong.
 *
 * Google's own error bodies are never forwarded. They quote the request back —
 * including the key on the Geocoding arm, where it travels as a query
 * parameter — and name project and quota details that are nobody's business on
 * the far side of this route. The status is enough for `geocoding.ts`, which
 * only ever reads `res.ok`.
 */
export function proxyError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

/**
 * Nothing here is cacheable. Autocomplete carries a session token that groups
 * one user's keystrokes into one billable session, and a shared cache that
 * served another user's suggestions for the same prefix would both leak what
 * they typed and bill the session twice.
 */
export const NO_STORE = { "Cache-Control": "no-store" } as const;

/** A Google place id: opaque, but a bounded token rather than free text. */
const PLACE_ID = /^[A-Za-z0-9_-]{1,255}$/;

export function isPlaceId(value: string): boolean {
  return PLACE_ID.test(value);
}

/**
 * The autocomplete body, rebuilt from validated parts rather than forwarded.
 *
 * Forwarding the client's object would let anything reaching this route set
 * fields the app never sends — `includedRegionCodes`, `includedPrimaryTypes`,
 * a different SKU's parameters — on a key they cannot see. Naming the three
 * fields the app actually uses is what keeps the relay narrow.
 */
export type AutocompleteBody = {
  input: string;
  sessionToken?: string;
  locationBias?: unknown;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string };

/** Matches the `circle` bias `searchPlaces` sends, and nothing else. */
function isLocationBias(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const circle = (value as { circle?: unknown }).circle;
  if (typeof circle !== "object" || circle === null) return false;
  const { center, radius } = circle as { center?: unknown; radius?: unknown };
  if (typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0) {
    return false;
  }
  if (typeof center !== "object" || center === null) return false;
  const { latitude, longitude } = center as {
    latitude?: unknown;
    longitude?: unknown;
  };
  return isLatitude(latitude) && isLongitude(longitude);
}

function isLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 90;
}

function isLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 180;
}

/** Long enough for any real query, short enough not to be a payload. */
const MAX_INPUT_LENGTH = 200;
const MAX_SESSION_TOKEN_LENGTH = 64;

export function validateAutocomplete(body: unknown): Validated<AutocompleteBody> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, status: 400, message: "Expected a JSON object" };
  }
  const { input, sessionToken, locationBias } = body as Record<string, unknown>;

  if (typeof input !== "string" || input.trim().length < 2) {
    return { ok: false, status: 400, message: "input must be at least 2 characters" };
  }
  if (input.length > MAX_INPUT_LENGTH) {
    return { ok: false, status: 400, message: "input is too long" };
  }
  if (
    sessionToken !== undefined &&
    (typeof sessionToken !== "string" ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(sessionToken) ||
      sessionToken.length > MAX_SESSION_TOKEN_LENGTH)
  ) {
    return { ok: false, status: 400, message: "sessionToken is malformed" };
  }
  if (locationBias !== undefined && !isLocationBias(locationBias)) {
    return { ok: false, status: 400, message: "locationBias is malformed" };
  }

  return {
    ok: true,
    value: {
      input,
      ...(sessionToken === undefined ? {} : { sessionToken }),
      ...(locationBias === undefined ? {} : { locationBias }),
    },
  };
}

/** `latlng=1.3009,103.8386`, as the Geocoding API spells it. */
export function validateLatLng(latlng: string | null): Validated<string> {
  if (!latlng) {
    return { ok: false, status: 400, message: "latlng is required" };
  }
  const [lat, lng, ...rest] = latlng.split(",");
  if (rest.length > 0) {
    return { ok: false, status: 400, message: "latlng is malformed" };
  }
  const latitude = Number(lat);
  const longitude = Number(lng);
  // `Number("")` is 0, so the emptiness check has to be its own — otherwise
  // `latlng=,` reads as the Gulf of Guinea rather than as a bad request.
  if (!lat?.trim() || !lng?.trim() || !isLatitude(latitude) || !isLongitude(longitude)) {
    return { ok: false, status: 400, message: "latlng is malformed" };
  }
  return { ok: true, value: `${latitude},${longitude}` };
}

/**
 * The field mask is set here, not taken from the request.
 *
 * It decides which Places SKU the call is billed at, so a client that could
 * choose it could choose the expensive one. These are the Essentials fields
 * `getPlaceDetails` reads, checked against Google's SKU table.
 */
export const PLACE_DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location,addressComponents";

export function placesUrl(path: string): string {
  return `${PLACES_BASE_URL}/${path}`;
}

export function geocodeUrl(latlng: string, key: string): string {
  return `${GEOCODE_URL}?latlng=${encodeURIComponent(latlng)}&key=${encodeURIComponent(key)}`;
}
