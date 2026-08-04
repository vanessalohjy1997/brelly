import {
  getPlaceDetails,
  searchPlaces,
  type PlaceDetails,
  type PlaceSuggestion,
} from "@/services/geocoding";
import { debounce } from "@/utils/debounce";
import { useCallback, useEffect, useMemo, useState } from "react";

export function usePlaceSearch() {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Built once, not per render. `debounce` closes over its own `timer`, so a
  // fresh one each render gives `cancel()` a *different* timer from the one
  // actually pending — every re-render between a keystroke and its 350ms
  // deadline orphaned a search that nothing could then call off. Blurring the
  // field could still fire the request it had just cancelled, and picking a
  // suggestion could still spend a call on the text it replaced.
  const search = useMemo(
    () =>
      debounce(async (input: string) => {
        if (input.trim().length < 2) {
          setSuggestions([]);
          return;
        }
        setIsSearching(true);
        setError(null);
        try {
          const results = await searchPlaces(input);
          setSuggestions(results);
        } catch {
          setError("Could not fetch suggestions");
        } finally {
          setIsSearching(false);
        }
      }, 350), // 350ms — fast enough to feel responsive, slow enough to avoid hammering the API
    [],
  );

  // Dismissing the form mid-word otherwise leaves a search 350ms from firing:
  // it spends a Places call on a screen nobody is looking at any more, and
  // lands its `setSuggestions` on a hook that is gone. Only correct because
  // `search` is stable — a per-render one would hand this the wrong timer.
  useEffect(() => search.cancel, [search]);

  const selectPlace = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      search.cancel(); // cancel any pending search if user selects before debounce fires
      try {
        const details = await getPlaceDetails(placeId);
        setSuggestions([]);
        return details;
      } catch {
        setError("Could not fetch place details");
        return null;
      }
    },
    [search],
  );

  const clearSuggestions = useCallback(() => {
    search.cancel();
    setSuggestions([]);
  }, [search]);

  return {
    suggestions,
    isSearching,
    error,
    search,
    selectPlace,
    clearSuggestions,
  };
}
