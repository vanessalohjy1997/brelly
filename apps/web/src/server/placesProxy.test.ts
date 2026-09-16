/**
 * @jest-environment node
 *
 * The route this serves runs on the server, and jsdom has no `Response` —
 * `proxyError` would fail here for a reason the production code never has.
 */
import {
  geocodeUrl,
  isPlaceId,
  PLACE_DETAILS_FIELD_MASK,
  placesApiKey,
  placesUrl,
  proxyError,
  validateAutocomplete,
  validateLatLng,
} from "./placesProxy";

/** The bias `searchPlaces` actually sends — Singapore, 30km. */
const BIAS = {
  circle: {
    center: { latitude: 1.3521, longitude: 103.8198 },
    radius: 30000,
  },
};

describe("placesApiKey", () => {
  const original = process.env.GOOGLE_PLACES_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.GOOGLE_PLACES_KEY;
    else process.env.GOOGLE_PLACES_KEY = original;
  });

  it("reads the server-only variable", () => {
    process.env.GOOGLE_PLACES_KEY = "AIza-test";
    expect(placesApiKey()).toBe("AIza-test");
  });

  it("treats a blank value as absent", () => {
    // An empty `.env` line would otherwise be interpolated into a request and
    // come back as a 400 pointing at Google rather than at the deploy.
    process.env.GOOGLE_PLACES_KEY = "   ";
    expect(placesApiKey()).toBeNull();
  });

  it("is null when nothing set it", () => {
    delete process.env.GOOGLE_PLACES_KEY;
    expect(placesApiKey()).toBeNull();
  });
});

describe("proxyError", () => {
  it("says only what went wrong, never Google's own body", async () => {
    const response = proxyError(502, "Place search failed");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Place search failed" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("isPlaceId", () => {
  it("accepts a real place id", () => {
    expect(isPlaceId("ChIJdYVSUTgZ2jERWmB2FMFj0wA")).toBe(true);
  });

  it.each(["../places", "a/b", "", "with space", "semi;colon"])(
    "rejects %p",
    (value) => {
      expect(isPlaceId(value)).toBe(false);
    },
  );

  it("rejects one longer than any Google issues", () => {
    expect(isPlaceId("a".repeat(256))).toBe(false);
  });
});

describe("validateAutocomplete", () => {
  it("accepts the body the app sends", () => {
    const result = validateAutocomplete({
      input: "Botanic",
      sessionToken: "abc123",
      locationBias: BIAS,
    });

    expect(result).toEqual({
      ok: true,
      value: { input: "Botanic", sessionToken: "abc123", locationBias: BIAS },
    });
  });

  it("drops every field the app does not send", () => {
    // Forwarding the client's object would let anything reaching this route
    // pick a different SKU on a key it cannot see.
    const result = validateAutocomplete({
      input: "Botanic",
      includedPrimaryTypes: ["restaurant"],
      languageCode: "ja",
    });

    expect(result).toEqual({ ok: true, value: { input: "Botanic" } });
  });

  it.each<[unknown, string]>([
    [undefined, "not an object"],
    ["Botanic", "a bare string"],
    [{ input: "B" }, "one character"],
    [{ input: "   " }, "whitespace"],
    [{ input: 42 }, "a number"],
  ])("rejects %p (%s)", (body) => {
    expect(validateAutocomplete(body)).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects an input long enough to be a payload", () => {
    expect(
      validateAutocomplete({ input: "a".repeat(201) }),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a session token that is not one", () => {
    expect(
      validateAutocomplete({ input: "Botanic", sessionToken: "a b" }),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("accepts the token core actually mints", () => {
    // `Math.random().toString(36).slice(2) + Date.now()`.
    const token = Math.random().toString(36).slice(2) + Date.now();
    expect(
      validateAutocomplete({ input: "Botanic", sessionToken: token }),
    ).toMatchObject({ ok: true });
  });

  it.each<[unknown, string]>([
    [{ circle: { center: { latitude: 1.35 }, radius: 30000 } }, "no longitude"],
    [{ circle: { center: { latitude: 91, longitude: 0 }, radius: 1 } }, "off the globe"],
    [{ circle: { center: { latitude: 1, longitude: 1 }, radius: 0 } }, "no radius"],
    [{ rectangle: {} }, "a shape the app never sends"],
  ])("rejects a bias with %p (%s)", (locationBias) => {
    expect(
      validateAutocomplete({ input: "Botanic", locationBias }),
    ).toMatchObject({ ok: false, status: 400 });
  });
});

describe("validateLatLng", () => {
  it("accepts a real fix and normalises it", () => {
    expect(validateLatLng("1.3009,103.8386")).toEqual({
      ok: true,
      value: "1.3009,103.8386",
    });
  });

  it("rejects an empty pair rather than reading it as 0,0", () => {
    // `Number("")` is 0, so `latlng=,` would otherwise be the Gulf of Guinea.
    expect(validateLatLng(",")).toMatchObject({ ok: false, status: 400 });
  });

  it.each([null, "", "1.3009", "1,2,3", "here,there", "91,0", "0,181"])(
    "rejects %p",
    (value) => {
      expect(validateLatLng(value)).toMatchObject({ ok: false, status: 400 });
    },
  );
});

describe("upstream URLs", () => {
  it("points Places at v1", () => {
    expect(placesUrl("places:autocomplete")).toBe(
      "https://places.googleapis.com/v1/places:autocomplete",
    );
  });

  it("points reverse geocoding at the other host, with the key", () => {
    expect(geocodeUrl("1.3009,103.8386", "AIza-test")).toBe(
      "https://maps.googleapis.com/maps/api/geocode/json?latlng=1.3009%2C103.8386&key=AIza-test",
    );
  });

  it("asks for the Essentials fields only", () => {
    // The mask decides the SKU, so it is a constant here rather than an input.
    expect(PLACE_DETAILS_FIELD_MASK.split(",")).toEqual([
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "addressComponents",
    ]);
  });
});
