import { act, renderHook } from "@testing-library/react-native";

import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { getPlaceDetails, searchPlaces } from "@/services/geocoding";

jest.mock("@/services/geocoding", () => ({
  searchPlaces: jest.fn(),
  getPlaceDetails: jest.fn(),
}));

const mockSearchPlaces = searchPlaces as jest.Mock;
const mockGetPlaceDetails = getPlaceDetails as jest.Mock;

const SUGGESTION = {
  placeId: "p1",
  displayName: "East Coast Park",
  secondaryText: "Singapore",
};

/** Past the 350ms debounce deadline. */
async function settleDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockSearchPlaces.mockResolvedValue([SUGGESTION]);
  mockGetPlaceDetails.mockResolvedValue({
    displayName: "East Coast Park, Singapore",
    latitude: 1.3009,
    longitude: 103.9124,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("usePlaceSearch", () => {
  it("searches once the typing stops", async () => {
    const { result } = await renderHook(() => usePlaceSearch());

    await act(async () => {
      result.current.search("East Coast");
    });
    await settleDebounce();

    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
    expect(result.current.suggestions).toEqual([SUGGESTION]);
  });

  it("collapses a burst of keystrokes into one request", async () => {
    const { result } = await renderHook(() => usePlaceSearch());

    await act(async () => {
      result.current.search("E");
      result.current.search("Ea");
      result.current.search("Eas");
      result.current.search("East");
    });
    await settleDebounce();

    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
    expect(mockSearchPlaces).toHaveBeenCalledWith("East");
  });

  it("asks for nothing on a query too short to mean anything", async () => {
    const { result } = await renderHook(() => usePlaceSearch());

    await act(async () => {
      result.current.search("E");
    });
    await settleDebounce();

    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });

  it("keeps the same debounce across renders, so a pending search can be called off", async () => {
    // Regression test. `debounce` closes over its own timer, so rebuilding it
    // on every render left `cancel()` holding a *different* timer from the one
    // pending — the search fired anyway, a render or two later. The form
    // re-renders constantly while you type, so this was the common case, not
    // the rare one.
    const { result } = await renderHook(() => usePlaceSearch());
    const first = result.current.search;

    await act(async () => {
      result.current.search("East Coast");
    });
    // A re-render between the keystroke and the deadline.
    await act(async () => {
      result.current.clearSuggestions();
    });
    await settleDebounce();

    expect(result.current.search).toBe(first);
    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });

  it("calls off a pending search when the form goes away", async () => {
    // Dismissing the form mid-word left a search 350ms from firing: it spent a
    // Places call on a screen nobody was looking at, and landed its
    // `setSuggestions` on a hook that no longer existed. In the test suite the
    // same timer surfaced as a stray search inside whichever test happened to
    // be running 350ms later.
    const { result, unmount } = await renderHook(() => usePlaceSearch());

    await act(async () => {
      result.current.search("East Coast");
    });
    await unmount();
    await settleDebounce();

    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });

  it("does not spend a request on text a picked place replaced", async () => {
    const { result } = await renderHook(() => usePlaceSearch());

    await act(async () => {
      result.current.search("East Coast");
    });
    await act(async () => {
      await result.current.selectPlace("p1");
    });
    await settleDebounce();

    expect(mockSearchPlaces).not.toHaveBeenCalled();
    expect(result.current.suggestions).toEqual([]);
  });

  it("reports a failed search rather than leaving stale suggestions", async () => {
    mockSearchPlaces.mockRejectedValue(new Error("network"));
    const { result } = await renderHook(() => usePlaceSearch());

    await act(async () => {
      result.current.search("East Coast");
    });
    await settleDebounce();

    expect(result.current.error).toBe("Could not fetch suggestions");
    expect(result.current.isSearching).toBe(false);
  });

  it("reports a failed lookup of the place that was picked", async () => {
    mockGetPlaceDetails.mockRejectedValue(new Error("network"));
    const { result } = await renderHook(() => usePlaceSearch());

    let details;
    await act(async () => {
      details = await result.current.selectPlace("p1");
    });

    expect(details).toBeNull();
    expect(result.current.error).toBe("Could not fetch place details");
  });
});
