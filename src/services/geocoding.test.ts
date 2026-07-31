import { reverseGeocode } from "@/services/geocoding";

/**
 * Trimmed from real Geocoding API responses for Ang Mo Kio (1.3785, 103.8560)
 * and Marina Bay Sands (1.2834, 103.8607) — the ordering, the `subpremise`
 * pairing on the top hit and the `plus_code` entry sitting mid-list are all
 * what the live API actually returns, not a guess at the shape.
 */
const AngMoKioResponse = {
  status: "OK",
  plus_code: { compound_code: "9VH4+C9 Singapore" },
  results: [
    {
      formatted_address: "2 Ang Mo Kio Dr, Singapore 567720",
      types: ["street_address", "subpremise"],
    },
    {
      formatted_address: "18 Ang Mo Kio Dr, Singapore 560000",
      types: ["premise", "street_address"],
    },
    { formatted_address: "9VH4+C9 Singapore", types: ["plus_code"] },
    { formatted_address: "2-9 Ang Mo Kio Dr, Singapore", types: ["route"] },
    { formatted_address: "Singapore", types: ["country", "political"] },
  ],
};

const MarinaBayResponse = {
  status: "OK",
  results: [
    {
      formatted_address: "1 Bayfront Ave, Singapore 018971",
      types: ["street_address", "subpremise"],
    },
    {
      formatted_address: "Bayfront Stn Exit B/MBS, Singapore",
      types: ["establishment", "point_of_interest", "transit_station"],
    },
  ],
};

function mockResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe("reverseGeocode", () => {
  it("returns the street address for a coordinate", async () => {
    fetchMock.mockReturnValue(mockResponse(AngMoKioResponse));

    await expect(reverseGeocode(1.3785, 103.856)).resolves.toBe(
      "2 Ang Mo Kio Dr, Singapore 567720",
    );
  });

  it("asks Google for the coordinate it was given", async () => {
    fetchMock.mockReturnValue(mockResponse(AngMoKioResponse));

    await reverseGeocode(1.3785, 103.856);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("latlng=1.3785,103.856"),
    );
  });

  it("prefers a street address over a nearby establishment", async () => {
    fetchMock.mockReturnValue(mockResponse(MarinaBayResponse));

    await expect(reverseGeocode(1.2834, 103.8607)).resolves.toBe(
      "1 Bayfront Ave, Singapore 018971",
    );
  });

  it("never returns a plus code, which means nothing to a reader", async () => {
    fetchMock.mockReturnValue(
      mockResponse({
        status: "OK",
        results: [
          { formatted_address: "9VH4+C9 Singapore", types: ["plus_code"] },
          { formatted_address: "Ang Mo Kio", types: ["neighborhood"] },
        ],
      }),
    );

    await expect(reverseGeocode(1.3785, 103.856)).resolves.toBe("Ang Mo Kio");
  });

  it("falls back to the first usable result when no preferred type matches", async () => {
    fetchMock.mockReturnValue(
      mockResponse({
        status: "OK",
        results: [
          { formatted_address: "Ang Mo Kio", types: ["neighborhood"] },
          { formatted_address: "Singapore", types: ["country"] },
        ],
      }),
    );

    await expect(reverseGeocode(1.3785, 103.856)).resolves.toBe("Ang Mo Kio");
  });

  it("returns null when Google has no result for the coordinate", async () => {
    fetchMock.mockReturnValue(mockResponse({ status: "ZERO_RESULTS", results: [] }));

    await expect(reverseGeocode(0, 0)).resolves.toBeNull();
  });

  it("returns null when the key is rejected, so the caller can fall back", async () => {
    // The API reports this with a 200 — treating it as success would put
    // an empty location on the plan.
    fetchMock.mockReturnValue(
      mockResponse({ status: "REQUEST_DENIED", error_message: "denied" }),
    );

    await expect(reverseGeocode(1.3785, 103.856)).resolves.toBeNull();
  });

  it("throws when the request itself fails", async () => {
    fetchMock.mockReturnValue(mockResponse({}, false, 500));

    await expect(reverseGeocode(1.3785, 103.856)).rejects.toThrow(
      "Reverse geocode error: 500",
    );
  });
});
