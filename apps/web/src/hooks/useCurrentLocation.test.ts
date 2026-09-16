import { act, renderHook, waitFor } from "@testing-library/react";

import { reverseGeocode } from "@brelly/core";

import { useCurrentLocation } from "./useCurrentLocation";

jest.mock("@brelly/core", () => ({
  ...jest.requireActual("@brelly/core"),
  reverseGeocode: jest.fn(),
}));

const mockReverseGeocode = reverseGeocode as jest.MockedFunction<
  typeof reverseGeocode
>;

/** A fix at 313@Somerset, the coordinates the rest of the suite uses. */
const POSITION = {
  coords: { latitude: 1.3009, longitude: 103.8386 },
} as GeolocationPosition;

function grantLocation(position: GeolocationPosition = POSITION) {
  const getCurrentPosition = jest.fn(
    (onSuccess: PositionCallback) => void onSuccess(position),
  );
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

function refuseLocation(code: number) {
  // jsdom has no `GeolocationPositionError`, and the hook reads `code` off the
  // rejection through `instanceof` — so the class has to exist for the refusal
  // branch to be reachable at all.
  class StubError {
    static PERMISSION_DENIED = 1;
    PERMISSION_DENIED = 1;
    constructor(readonly code: number) {}
  }
  (globalThis as { GeolocationPositionError?: unknown }).GeolocationPositionError =
    StubError;

  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: (
        _onSuccess: PositionCallback,
        onError: PositionErrorCallback,
      ) => onError(new StubError(code) as unknown as GeolocationPositionError),
    },
    configurable: true,
  });
}

afterEach(() => {
  delete (globalThis as { GeolocationPositionError?: unknown })
    .GeolocationPositionError;
  jest.clearAllMocks();
});

describe("useCurrentLocation", () => {
  it("names the fix with the reverse geocode", async () => {
    grantLocation();
    mockReverseGeocode.mockResolvedValue("313 Orchard Rd, Singapore");

    const { result } = renderHook(() => useCurrentLocation());

    const located = await act(() => result.current.getCurrentLocation());

    expect(located).toEqual({
      location: "313 Orchard Rd, Singapore",
      latitude: 1.3009,
      longitude: 103.8386,
    });
    expect(result.current.error).toBeNull();
  });

  it("keeps the coordinates when nothing can name them", async () => {
    // The browser has no on-device geocoder to fall back to — see the hook. The
    // point is that the stop is still placeable, just generically labelled.
    grantLocation();
    mockReverseGeocode.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useCurrentLocation());

    const located = await act(() => result.current.getCurrentLocation());

    expect(located).toEqual({
      location: "Current location",
      latitude: 1.3009,
      longitude: 103.8386,
    });
  });

  it("says a refusal can be undone, and where", async () => {
    refuseLocation(1);

    const { result } = renderHook(() => useCurrentLocation());

    const located = await act(() => result.current.getCurrentLocation());

    expect(located).toBeNull();
    expect(result.current.permissionDenied).toBe(true);
    expect(result.current.error).toMatch(/still type the place/);
  });

  it("tells a failed fix apart from a refused one", async () => {
    // Only a refusal has somewhere for the user to go, so only a refusal gets
    // the site-settings line.
    refuseLocation(2); // POSITION_UNAVAILABLE

    const { result } = renderHook(() => useCurrentLocation());

    await act(() => result.current.getCurrentLocation());

    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.error).toBe("Could not get your location");
  });

  it("fails rather than hanging where there is no geolocation at all", async () => {
    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      configurable: true,
    });

    const { result } = renderHook(() => useCurrentLocation());

    expect(await act(() => result.current.getCurrentLocation())).toBeNull();
    expect(result.current.error).toBe("Could not get your location");
  });

  it("stops reporting that it is locating once it has an answer", async () => {
    grantLocation();
    mockReverseGeocode.mockResolvedValue("313 Orchard Rd, Singapore");

    const { result } = renderHook(() => useCurrentLocation());

    await act(() => result.current.getCurrentLocation());

    await waitFor(() => expect(result.current.isLocating).toBe(false));
  });
});
