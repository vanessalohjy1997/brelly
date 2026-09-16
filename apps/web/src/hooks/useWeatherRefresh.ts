"use client";

import { useQueryClient, type Query } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { showToast } from "@brelly/core";

// Every query key this app uses for weather data. Refetching by prefix rather
// than clearing the whole cache keeps unrelated queries (place lookups) alone.
const WEATHER_QUERY_KEYS = [
  "weather",
  "nearbyForecast",
  "liveConditions",
  "airQuality",
];

const isWeatherQuery = (query: Query) =>
  WEATHER_QUERY_KEYS.includes(query.queryKey[0] as string);

/**
 * Refreshing the weather on a screen.
 *
 * The phone hangs this off pull-to-refresh, which has no honest web equivalent
 * — a page that hijacks the overscroll gesture fights the browser's own
 * pull-to-reload — so here it is an explicit button. The hook itself ports
 * unchanged.
 *
 * Forecast queries carry a 10-minute `staleTime`, so an ordinary invalidate can
 * resolve from cache and return instantly, which reads as a broken control.
 * `refetchQueries` forces the request regardless of staleness.
 */
export function useWeatherRefresh() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({ predicate: isWeatherQuery });

      // The spinner retracting is the only thing the gesture used to produce.
      // Staleness was shown per badge, so a screen of cards all still saying
      // "2h ago" — because every request failed — looked exactly like a screen
      // that had just refreshed. This answers once, for the screen, instead of
      // making the user audit eight cards.
      const queries = queryClient
        .getQueryCache()
        .findAll({ predicate: isWeatherQuery });
      // Nothing to refresh is not a failure and not worth a toast: it is the
      // empty state's button on a screen with no forecast queries mounted.
      if (queries.length === 0) return;

      if (queries.some((query) => query.state.status === "error")) {
        showToast("Couldn't reach the weather service", "error");
      } else {
        showToast("Weather updated");
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return { isRefreshing, refresh };
}
