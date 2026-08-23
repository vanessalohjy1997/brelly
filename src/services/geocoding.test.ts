import {
  getPlaceDetails,
  reverseGeocode,
  searchPlaces,
} from "@/services/geocoding";

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

describe("searchPlaces", () => {
  it("no longer restricts results to Singapore, so overseas places can be found", async () => {
    fetchMock.mockReturnValue(mockResponse({ suggestions: [] }));

    await searchPlaces("Shibuya Crossing");

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).not.toHaveProperty("includedRegionCodes");
    // The Singapore-centred bias is a ranking preference, not a filter, and
    // stays in place.
    expect(requestBody.locationBias.circle.center).toEqual({
      latitude: 1.3521,
      longitude: 103.8198,
    });
  });

  it("does not default a missing secondaryText to Singapore", async () => {
    fetchMock.mockReturnValue(
      mockResponse({
        suggestions: [
          {
            placePrediction: {
              placeId: "p1",
              structuredFormat: { mainText: { text: "Shibuya Crossing" } },
            },
          },
        ],
      }),
    );

    const results = await searchPlaces("Shibuya Crossing");

    expect(results[0].secondaryText).toBe("");
  });
});

describe("getPlaceDetails", () => {
  /**
   * Trimmed from a live Place Details response for Gardens by the Bay. The
   * country component is the shape that matters: `longText` is the country's
   * *name* ("Singapore") and only `shortText` is the code, so reading the
   * wrong one gives a country name where an ISO code was expected.
   */
  const GardensByTheBayResponse = {
    id: "ChIJMxZ-kwQZ2jERdsqftXeWCWI",
    displayName: { text: "Gardens by the Bay", languageCode: "en" },
    formattedAddress: "18 Marina Gardens Dr, Singapore 018953",
    location: { latitude: 1.2815683, longitude: 103.8636132 },
    addressComponents: [
      { longText: "18", shortText: "18", types: ["street_number"] },
      {
        longText: "Marina Gardens Drive",
        shortText: "Marina Gardens Dr",
        types: ["route"],
      },
      {
        longText: "Singapore",
        shortText: "Singapore",
        types: ["locality", "political"],
      },
      {
        longText: "Singapore",
        shortText: "SG",
        types: ["country", "political"],
      },
    ],
  };

  it("returns the place and where it is", async () => {
    fetchMock.mockReturnValue(mockResponse(GardensByTheBayResponse));

    await expect(getPlaceDetails("ChIJMxZ-kwQZ2jERdsqftXeWCWI")).resolves.toEqual(
      {
        placeId: "ChIJMxZ-kwQZ2jERdsqftXeWCWI",
        displayName: "Gardens by the Bay",
        formattedAddress: "18 Marina Gardens Dr, Singapore 018953",
        latitude: 1.2815683,
        longitude: 103.8636132,
        countryCode: "SG",
      },
    );
  });

  // The country is what stops the gap warning firing on a flight
  // (`detectScheduleConflicts`), and Places sends nothing it wasn't asked for.
  it("asks for the address components, or there is no country to read", async () => {
    fetchMock.mockReturnValue(mockResponse(GardensByTheBayResponse));

    await getPlaceDetails("ChIJMxZ-kwQZ2jERdsqftXeWCWI");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Goog-FieldMask"]).toContain("addressComponents");
  });

  it("takes the country's code, not its name", async () => {
    fetchMock.mockReturnValue(
      mockResponse({
        ...GardensByTheBayResponse,
        addressComponents: [
          {
            longText: "Japan",
            shortText: "JP",
            types: ["country", "political"],
          },
        ],
      }),
    );

    await expect(
      getPlaceDetails("p1").then((d) => d.countryCode),
    ).resolves.toBe("JP");
  });

  // Absent has to stay absent: `detectScheduleConflicts` reads it as *unknown*
  // and falls back to distance, which a made-up default would defeat.
  it("names no country when the response has no country component", async () => {
    fetchMock.mockReturnValue(
      mockResponse({
        ...GardensByTheBayResponse,
        addressComponents: [
          { longText: "18", shortText: "18", types: ["street_number"] },
        ],
      }),
    );

    await expect(
      getPlaceDetails("p1").then((d) => d.countryCode),
    ).resolves.toBeUndefined();
  });

  it("names no country when the response carries no components at all", async () => {
    const { addressComponents, ...withoutComponents } = GardensByTheBayResponse;
    fetchMock.mockReturnValue(mockResponse(withoutComponents));

    await expect(
      getPlaceDetails("p1").then((d) => d.countryCode),
    ).resolves.toBeUndefined();
  });

  it("throws when the request itself fails", async () => {
    fetchMock.mockReturnValue(mockResponse({}, false, 404));

    await expect(getPlaceDetails("p1")).rejects.toThrow(
      "Place details error: 404",
    );
  });
});
