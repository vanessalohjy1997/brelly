import { act, renderHook } from "@testing-library/react-native";
import * as Location from "expo-location";
import type { LocationGeocodedAddress } from "expo-location";

import {
  formatReverseGeocodedAddress,
  useCurrentLocation,
} from "@/hooks/useCurrentLocation";
import { reverseGeocode } from "@/services/geocoding";

jest.mock("@/services/geocoding", () => ({ reverseGeocode: jest.fn() }));

const googleReverseGeocode = reverseGeocode as jest.MockedFunction<
  typeof reverseGeocode
>;
const requestPermissions =
  Location.requestForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.requestForegroundPermissionsAsync
  >;
const getPosition = Location.getCurrentPositionAsync as jest.MockedFunction<
  typeof Location.getCurrentPositionAsync
>;
const deviceReverseGeocode =
  Location.reverseGeocodeAsync as jest.MockedFunction<
    typeof Location.reverseGeocodeAsync
  >;

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

  it("attaches the street number to the street name", () => {
    const result = formatReverseGeocodedAddress(
      address({
        name: "90 Thomson Terrace",
        streetNumber: "90",
        street: "Thomson Terrace",
        city: "Singapore",
        postalCode: "574606",
      }),
    );
    expect(result).toBe("90 Thomson Terrace, Singapore 574606");
  });

  it("drops a bare street number rather than showing it as an address", () => {
    const result = formatReverseGeocodedAddress(
      address({ name: "20", streetNumber: "20", city: "Singapore" }),
    );
    expect(result).toBe("Singapore");
  });

  it("falls back to district when there is no city", () => {
    const result = formatReverseGeocodedAddress(
      address({ street: "Thomson Terrace", district: "Bishan" }),
    );
    expect(result).toBe("Thomson Terrace, Bishan");
  });

  it("returns a generic label when nothing is available", () => {
    const result = formatReverseGeocodedAddress(address({}));
    expect(result).toBe("Current location");
  });
});

describe("useCurrentLocation", () => {
  // Ang Mo Kio — the coordinates Apple's geocoder describes as just
  // "Singapore", which is what moved this onto Google in the first place.
  const AngMoKio = { latitude: 1.3785, longitude: 103.856 };

  beforeEach(() => {
    jest.clearAllMocks();
    requestPermissions.mockResolvedValue({
      status: "granted",
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);
    getPosition.mockResolvedValue({ coords: AngMoKio } as Awaited<
      ReturnType<typeof Location.getCurrentPositionAsync>
    >);
    deviceReverseGeocode.mockResolvedValue([]);
    googleReverseGeocode.mockResolvedValue(null);
  });

  async function locate() {
    // `renderHook` is asynchronous in React Native Testing Library 14.
    const { result } = await renderHook(() => useCurrentLocation());
    let value: Awaited<
      ReturnType<ReturnType<typeof useCurrentLocation>["getCurrentLocation"]>
    >;
    await act(async () => {
      value = await result.current.getCurrentLocation();
    });
    return { value: value!, error: result.current.error };
  }

  it("names the location from Google, with the coordinates it was found at", async () => {
    googleReverseGeocode.mockResolvedValue("2 Ang Mo Kio Dr, Singapore 567720");

    const { value } = await locate();

    expect(googleReverseGeocode).toHaveBeenCalledWith(1.3785, 103.856);
    expect(value).toEqual({
      location: "2 Ang Mo Kio Dr, Singapore 567720",
      ...AngMoKio,
    });
    // Google answered, so there's no reason to ask the device as well.
    expect(deviceReverseGeocode).not.toHaveBeenCalled();
  });

  it("falls back to the device geocoder when Google has no address", async () => {
    googleReverseGeocode.mockResolvedValue(null);
    deviceReverseGeocode.mockResolvedValue([
      address({ street: "Ang Mo Kio Drive", city: "Singapore" }),
    ]);

    const { value } = await locate();

    expect(value.location).toBe("Ang Mo Kio Drive, Singapore");
  });

  it("falls back to the device geocoder when the Google request fails", async () => {
    // Offline, or a key that's out of quota — a coarse address still beats
    // dropping the user's location entirely.
    googleReverseGeocode.mockRejectedValue(new Error("network down"));
    deviceReverseGeocode.mockResolvedValue([address({ city: "Singapore" })]);

    const { value } = await locate();

    expect(value.location).toBe("Singapore");
  });

  it("labels the spot generically when neither geocoder knows it", async () => {
    const { value } = await locate();

    expect(value.location).toBe("Current location");
  });

  it("reports an error and no location when permission is refused", async () => {
    requestPermissions.mockResolvedValue({
      status: "denied",
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);

    const { value, error } = await locate();

    expect(value).toBeNull();
    expect(error).toBe("Location permission denied");
    expect(googleReverseGeocode).not.toHaveBeenCalled();
  });
});
