import {
  getPlaceDetails,
  searchPlaces,
  type PlaceDetails,
  type PlaceSuggestion,
} from "@/services/geocoding";
import { debounce } from "@/utils/debounce";
import { useCallback, useState } from "react";

export function usePlaceSearch() {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = debounce(async (input: string) => {
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
  }, 350); // 350ms — fast enough to feel responsive, slow enough to avoid hammering the API

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
