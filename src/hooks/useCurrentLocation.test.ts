import { formatReverseGeocodedAddress } from "@/hooks/useCurrentLocation";
import type { LocationGeocodedAddress } from "expo-location";

function address(overrides: Partial<LocationGeocodedAddress>): LocationGeocodedAddress {
  return {
    city: null,
    district: null,
    streetNumber: null,
    street: null,
    region: null,
    subregion: null,
    country: null,
    postalCode: null,
    name: null,
    isoCountryCode: null,
    timezone: null,
    formattedAddress: null,
    ...overrides,
  };
}

describe("formatReverseGeocodedAddress", () => {
  it("prefers formattedAddress when present", () => {
    const result = formatReverseGeocodedAddress(
      address({ formattedAddress: "1 Fullerton Rd, Singapore", name: "Merlion Park" }),
    );
    expect(result).toBe("1 Fullerton Rd, Singapore");
  });

  it("falls back to name, street, and city when formattedAddress is absent", () => {
    const result = formatReverseGeocodedAddress(
      address({ name: "Merlion Park", street: "Fullerton Rd", city: "Singapore" }),
    );
    expect(result).toBe("Merlion Park, Fullerton Rd, Singapore");
  });

  it("dedupes when the placemark name repeats the street", () => {
    const result = formatReverseGeocodedAddress(
      address({ name: "Fullerton Rd", street: "Fullerton Rd", city: "Singapore" }),
    );
    expect(result).toBe("Fullerton Rd, Singapore");
  });

  it("returns a generic label when nothing is available", () => {
    const result = formatReverseGeocodedAddress(address({}));
    expect(result).toBe("Current location");
  });
});
