/**
 * @jest-environment node
 */
import { GET } from "./route";

const fetchMock = jest.fn();

function request(query: string) {
  return new Request(`http://localhost/api/places/geocode${query}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_PLACES_KEY = "AIza-test";
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  delete process.env.GOOGLE_PLACES_KEY;
});

describe("GET /api/places/geocode", () => {
  it("calls the Geocoding host with the key as a query parameter", async () => {
    // A different host and SKU from Places, on the same key — which is why the
    // proxy arm of `PlacesConfig` carries two paths.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "OK", results: [] }),
    });

    const response = await GET(request("?latlng=1.3009,103.8386"));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://maps.googleapis.com/maps/api/geocode/json?latlng=1.3009%2C103.8386&key=AIza-test",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes the in-body status through, because a failure arrives as a 200", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    });

    const response = await GET(request("?latlng=1.3009,103.8386"));

    expect(await response.json()).toEqual({
      status: "ZERO_RESULTS",
      results: [],
    });
  });

  it("drops the message Google writes for whoever holds the key", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "REQUEST_DENIED",
        error_message: "This API project is not authorized to use this API.",
        results: [],
      }),
    });

    const body = await (await GET(request("?latlng=1.3009,103.8386"))).json();

    expect(body).toEqual({ status: "REQUEST_DENIED", results: [] });
  });

  it("rejects a missing fix rather than geocoding nothing", async () => {
    const response = await GET(request(""));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty pair rather than reading it as 0,0", async () => {
    const response = await GET(request("?latlng=,"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects coordinates off the globe", async () => {
    const response = await GET(request("?latlng=91,0"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the feature is unavailable when the deploy has no key", async () => {
    delete process.env.GOOGLE_PLACES_KEY;

    const response = await GET(request("?latlng=1.3009,103.8386"));

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an upstream failure's body to itself", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error_message: "You have exceeded your daily request quota" }),
    });

    const response = await GET(request("?latlng=1.3009,103.8386"));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Reverse geocoding failed",
    });
  });
});
