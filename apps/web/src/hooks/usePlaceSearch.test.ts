import { act, renderHook, waitFor } from "@testing-library/react";

import { getPlaceDetails, searchPlaces } from "@brelly/core";

import { usePlaceSearch } from "./usePlaceSearch";

jest.mock("@brelly/core", () => ({
  ...jest.requireActual("@brelly/core"),
  searchPlaces: jest.fn(),
  getPlaceDetails: jest.fn(),
}));

const mockSearchPlaces = searchPlaces as jest.MockedFunction<
  typeof searchPlaces
>;
const mockGetPlaceDetails = getPlaceDetails as jest.MockedFunction<
  typeof getPlaceDetails
>;

/** The shape Places actually returns, not a convenient two-field guess. */
const SUGGESTION = {
  placeId: "ChIJdYVSUTgZ2jERWmB2FMFj0wA",
  displayName: "Singapore Botanic Gardens",
  secondaryText: "Cluny Road, Singapore",
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Lets the 350ms debounce fire and its promise settle. */
async function runDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
}

describe("usePlaceSearch", () => {
  it("waits out the debounce before spending a Places call", async () => {
    mockSearchPlaces.mockResolvedValue([SUGGESTION]);
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("Botanic"));
    expect(mockSearchPlaces).not.toHaveBeenCalled();

    await runDebounce();

    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
    expect(mockSearchPlaces).toHaveBeenCalledWith("Botanic");
    await waitFor(() => expect(result.current.suggestions).toEqual([SUGGESTION]));
  });

  it("spends one call on a word typed a letter at a time", async () => {
    mockSearchPlaces.mockResolvedValue([SUGGESTION]);
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("Bot"));
    act(() => jest.advanceTimersByTime(100));
    act(() => result.current.search("Bota"));
    act(() => jest.advanceTimersByTime(100));
    act(() => result.current.search("Botan"));
    await runDebounce();

    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
    expect(mockSearchPlaces).toHaveBeenCalledWith("Botan");
  });

  it("does not search a single letter", async () => {
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("B"));
    await runDebounce();

    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });

  it("clears the list when the field is emptied", async () => {
    mockSearchPlaces.mockResolvedValue([SUGGESTION]);
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("Botanic"));
    await runDebounce();
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    act(() => result.current.search(""));
    await runDebounce();

    expect(result.current.suggestions).toEqual([]);
  });

  it("says so when the suggestions cannot be fetched", async () => {
    mockSearchPlaces.mockRejectedValue(new Error("502"));
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("Botanic"));
    await runDebounce();

    await waitFor(() =>
      expect(result.current.error).toBe("Could not fetch suggestions"),
    );
    expect(result.current.isSearching).toBe(false);
  });

  it("returns the details of a chosen place and empties the list", async () => {
    mockSearchPlaces.mockResolvedValue([SUGGESTION]);
    mockGetPlaceDetails.mockResolvedValue({
      placeId: SUGGESTION.placeId,
      displayName: "Singapore Botanic Gardens, Cluny Road, Singapore",
      formattedAddress: "1 Cluny Rd, Singapore 259569",
      latitude: 1.3138,
      longitude: 103.8159,
      countryCode: "SG",
    });
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("Botanic"));
    await runDebounce();
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    const details = await act(() =>
      result.current.selectPlace(SUGGESTION.placeId),
    );

    expect(details?.latitude).toBe(1.3138);
    expect(result.current.suggestions).toEqual([]);
  });

  it("calls off a pending search when a suggestion is chosen", async () => {
    // Otherwise the debounce fires after the choice and repopulates the list
    // under a place that has already been picked.
    mockGetPlaceDetails.mockResolvedValue({
      placeId: SUGGESTION.placeId,
      displayName: "Singapore Botanic Gardens",
      formattedAddress: "1 Cluny Rd, Singapore 259569",
      latitude: 1.3138,
      longitude: 103.8159,
    });
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("Botanic"));
    await act(() => result.current.selectPlace(SUGGESTION.placeId));
    await runDebounce();

    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });

  it("says so when the chosen place cannot be resolved", async () => {
    mockGetPlaceDetails.mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => usePlaceSearch());

    const details = await act(() =>
      result.current.selectPlace(SUGGESTION.placeId),
    );

    expect(details).toBeNull();
    expect(result.current.error).toBe("Could not fetch place details");
  });

  it("clears the list and the pending search together", async () => {
    mockSearchPlaces.mockResolvedValue([SUGGESTION]);
    const { result } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("Botanic"));
    await runDebounce();
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    act(() => result.current.search("Botanic Gard"));
    act(() => result.current.clearSuggestions());
    await runDebounce();

    expect(result.current.suggestions).toEqual([]);
    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
  });

  it("cancels a search still pending when the page is left", async () => {
    // A search 350ms from firing would spend a Places call on a page nobody is
    // looking at, and land its state write on a hook that is gone.
    const { result, unmount } = renderHook(() => usePlaceSearch());

    act(() => result.current.search("Botanic"));
    unmount();
    await runDebounce();

    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });
});
