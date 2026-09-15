import {
  geocodeUrl,
  NO_STORE,
  placesApiKey,
  proxyError,
  validateLatLng,
} from "@/server/placesProxy";

/**
 * Reverse geocoding — a different host and a different SKU from Places, on the
 * same key, which is why `PlacesConfig`'s proxy arm carries two paths rather
 * than one base URL.
 *
 * This is the arm where forwarding Google's error body would be worst: the key
 * travels as a query parameter here, and the API quotes the request back in its
 * `error_message`. `proxyError` is what keeps that on this side of the route.
 */
export async function GET(request: Request) {
  const latlng = validateLatLng(
    new URL(request.url).searchParams.get("latlng"),
  );
  if (!latlng.ok) return proxyError(latlng.status, latlng.message);

  const key = placesApiKey();
  if (!key) return proxyError(500, "Reverse geocoding is unavailable");

  const upstream = await fetch(geocodeUrl(latlng.value, key));

  if (!upstream.ok) {
    return proxyError(upstream.status, "Reverse geocoding failed");
  }

  // Narrowed to the two fields `reverseGeocode` reads. The API reports its own
  // failures *in the body* with a 200, so `status` has to come through — but
  // the `error_message` beside it is written for whoever holds the key, and
  // that is this server rather than the browser.
  const body = (await upstream.json()) as { status?: unknown; results?: unknown };
  return Response.json(
    { status: body.status ?? "UNKNOWN_ERROR", results: body.results ?? [] },
    { headers: NO_STORE },
  );
}
