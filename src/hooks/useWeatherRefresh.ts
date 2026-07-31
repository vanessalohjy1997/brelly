import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

// Every query key this app uses for weather data. Refetching by prefix rather
// than clearing the whole cache keeps unrelated queries (place lookups) alone.
const WEATHER_QUERY_KEYS = [
  "weather",
  "nearbyForecast",
  "liveConditions",
  "airQuality",
];

/**
 * Pull-to-refresh for the weather on a screen.
 *
 * Forecast queries carry a 10-minute `staleTime`, so an ordinary invalidate
 * can resolve from cache and return instantly — which reads as a broken
 * gesture. `refetchQueries` forces the request regardless of staleness.
 */
export function useWeatherRefresh() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({
        predicate: (query) =>
          WEATHER_QUERY_KEYS.includes(query.queryKey[0] as string),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return { isRefreshing, refresh };
}
