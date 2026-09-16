"use client";

import {
  debounce,
  getPlaceDetails,
  searchPlaces,
  type PlaceDetails,
  type PlaceSuggestion,
} from "@brelly/core";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Place search, unchanged from the phone's — the request itself goes through
 * `/api/places` here rather than straight to Google, and that difference lives
 * entirely in `configureCore()`.
 */
export function usePlaceSearch() {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Built once, not per render. `debounce` closes over its own timer, so a
  // fresh one each render gives `cancel()` a *different* timer from the one
  // actually pending — every re-render between a keystroke and its 350ms
  // deadline orphaned a search that nothing could then call off.
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
      }, 350), // fast enough to feel responsive, slow enough not to hammer the API
    [],
  );

  // Leaving the page mid-word otherwise leaves a search 350ms from firing: it
  // spends a Places call on a page nobody is looking at, and lands its
  // `setSuggestions` on a hook that is gone. Only correct because `search` is
  // stable — a per-render one would hand this the wrong timer.
  useEffect(() => search.cancel, [search]);

  const selectPlace = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      search.cancel(); // a selection before the debounce fires calls it off
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
