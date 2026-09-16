/**
 * @jest-environment node
 *
 * A route handler is server code: it is handed a `Request` and returns a
 * `Response`, neither of which jsdom has.
 */
import { GET, POST } from "./route";

const fetchMock = jest.fn();

/** The one path POST accepts, with the body the app sends. */
function autocompleteRequest(body: unknown = { input: "Botanic" }) {
  return new Request("http://localhost/api/places/places:autocomplete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function params(...path: string[]) {
  return { params: Promise.resolve({ path }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_PLACES_KEY = "AIza-test";
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  delete process.env.GOOGLE_PLACES_KEY;
});

function upstreamOk(json: unknown) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => json });
}

describe("POST /api/places/*", () => {
  it("forwards autocomplete with the key the browser never sees", async () => {
    upstreamOk({ suggestions: [] });

    const response = await POST(
      autocompleteRequest(),
      params("places:autocomplete"),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(
      "AIza-test",
    );
  });

  it("never caches a response", async () => {
    // Autocomplete carries a session token that groups one user's keystrokes
    // into one billable session.
    upstreamOk({ suggestions: [] });

    const response = await POST(
      autocompleteRequest(),
      params("places:autocomplete"),
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sends only the fields it validated, not the body it was given", async () => {
    upstreamOk({ suggestions: [] });

    await POST(
      autocompleteRequest({ input: "Botanic", languageCode: "ja" }),
      params("places:autocomplete"),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ input: "Botanic" });
  });

  it("404s any other path before it reads the key", async () => {
    const response = await POST(autocompleteRequest(), params("places:searchText"));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404s a nested path too", async () => {
    const response = await POST(
      autocompleteRequest(),
      params("places", "anything"),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const request = new Request(
      "http://localhost/api/places/places:autocomplete",
      { method: "POST", body: "not json" },
    );

    const response = await POST(request, params("places:autocomplete"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an input too short to search on", async () => {
    const response = await POST(
      autocompleteRequest({ input: "B" }),
      params("places:autocomplete"),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the feature is unavailable when the deploy has no key", async () => {
    delete process.env.GOOGLE_PLACES_KEY;

    const response = await POST(
      autocompleteRequest(),
      params("places:autocomplete"),
    );

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps Google's error body on this side of the route", async () => {
    // It quotes the request back and names project and quota details.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "API key not valid: AIza-test" } }),
    });

    const response = await POST(
      autocompleteRequest(),
      params("places:autocomplete"),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Place search failed" });
  });
});

describe("GET /api/places/places/:id", () => {
  it("sets the field mask itself, because the mask is the SKU", async () => {
    upstreamOk({ id: "ChIJ" });

    const response = await GET(
      new Request("http://localhost/api/places/places/ChIJdYVSUTgZ2jERWmB2FMFj0wA"),
      params("places", "ChIJdYVSUTgZ2jERWmB2FMFj0wA"),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://places.googleapis.com/v1/places/ChIJdYVSUTgZ2jERWmB2FMFj0wA",
    );
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe(
      "id,displayName,formattedAddress,location,addressComponents",
    );
  });

  it("404s a place id that is not one, rather than putting it in a URL", async () => {
    const response = await GET(
      new Request("http://localhost/api/places/places/..%2Fsecret"),
      params("places", "../secret"),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404s the autocomplete path on the wrong verb's handler", async () => {
    const response = await GET(
      new Request("http://localhost/api/places/places:autocomplete"),
      params("places:autocomplete"),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says nothing about why the lookup failed upstream", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: "Place not found" } }),
    });

    const response = await GET(
      new Request("http://localhost/api/places/places/ChIJ"),
      params("places", "ChIJ"),
    );

    expect(await response.json()).toEqual({ error: "Place lookup failed" });
  });
});
