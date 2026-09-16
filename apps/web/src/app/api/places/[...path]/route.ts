import {
  isPlaceId,
  NO_STORE,
  PLACE_DETAILS_FIELD_MASK,
  placesApiKey,
  placesUrl,
  proxyError,
  validateAutocomplete,
} from "@/server/placesProxy";

/**
 * The two Places calls the app makes, and nothing else.
 *
 * A catch-all segment is the routing shape, not the authorisation model: the
 * first thing each handler does is check the path against the one form it
 * accepts. Anything else is a 404 before `placesApiKey()` is read, so an
 * unknown path costs no quota and cannot reach Google at all.
 *
 * `POST` is the only verb autocomplete has — the Places v1 autocomplete
 * endpoint takes a JSON body — and `GET` is the only one details has. A method
 * with no handler is a 405 from Next itself.
 */

type Context = { params: Promise<{ path: string[] }> };

export async function POST(request: Request, context: Context) {
  const { path } = await context.params;
  if (path.length !== 1 || path[0] !== "places:autocomplete") {
    return proxyError(404, "Not found");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return proxyError(400, "Expected a JSON body");
  }

  const validated = validateAutocomplete(body);
  if (!validated.ok) return proxyError(validated.status, validated.message);

  const key = placesApiKey();
  if (!key) return proxyError(500, "Place search is unavailable");

  const upstream = await fetch(placesUrl("places:autocomplete"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    // The validated object, not the request body — see `validateAutocomplete`
    // for why a forwarded body is a way to spend someone else's key on a SKU
    // they chose.
    body: JSON.stringify(validated.value),
  });

  if (!upstream.ok) {
    return proxyError(upstream.status, "Place search failed");
  }

  return Response.json(await upstream.json(), { headers: NO_STORE });
}

export async function GET(_request: Request, context: Context) {
  const { path } = await context.params;
  if (path.length !== 2 || path[0] !== "places" || !isPlaceId(path[1])) {
    return proxyError(404, "Not found");
  }

  const key = placesApiKey();
  if (!key) return proxyError(500, "Place lookup is unavailable");

  const upstream = await fetch(placesUrl(`places/${path[1]}`), {
    headers: {
      "X-Goog-Api-Key": key,
      // Set here rather than taken from the request: the mask decides which
      // SKU the call is billed at.
      "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
    },
  });

  if (!upstream.ok) {
    return proxyError(upstream.status, "Place lookup failed");
  }

  return Response.json(await upstream.json(), { headers: NO_STORE });
}
