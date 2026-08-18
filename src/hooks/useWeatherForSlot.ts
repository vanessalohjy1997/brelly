import { useQuery } from "@tanstack/react-query";

import { getForecastForSlotByProvider } from "@/services/forecastProvider";
import { mmkvStorage } from "@/store/mmkvStorage";
import { NeaRegion } from "@/types/weather";
import {
  forecastCacheKey,
  readCachedForecast,
  writeCachedForecast,
} from "@/utils/forecastCache";
import type { WeatherProvider } from "@/utils/weatherProvider";

type Params = {
  provider: WeatherProvider;
  region: NeaRegion;
  latitude: number;
  longitude: number;
  slotStartTime: string; // ISO string
  /**
   * Off for a stop that has already finished. Neither provider serves
   * history, so the request can only come back as "unavailable" — and an
   * archive of a hundred past stops would fire a hundred of them to render a
   * hundred "No forecast" lines.
   */
  enabled?: boolean;
};

export function useWeatherForSlot({
  provider,
  region,
  latitude,
  longitude,
  slotStartTime,
  enabled = true,
}: Params) {
  return useQuery({
    queryKey: ["weather", provider, region, latitude, longitude, slotStartTime],
    queryFn: async () => {
      const cacheKey = forecastCacheKey({ latitude, longitude, slotStartTime });
      const forecast = await getForecastForSlotByProvider({
        provider,
        region,
        latitude,
        longitude,
        slotStartTime,
      });

      // The dispatcher reports a failed request as `source: "error"` rather
      // than throwing, so React Query's own retry/error path never sees it —
      // the offline fallback has to happen here. The cache key is
      // coordinate+time only, with no provider component, but that's safe:
      // a given coordinate pair deterministically maps to one provider.
      if (forecast.source === "error") {
        const cached = readCachedForecast(mmkvStorage, cacheKey);
        if (cached) return cached;
        return forecast;
      }

      writeCachedForecast(mmkvStorage, cacheKey, forecast);
      return forecast;
    },
    staleTime: 1000 * 60 * 10,
    enabled: enabled && !!region && !!slotStartTime,
    // Refetch automatically when the app comes back to the foreground
    // so forecasts update if the user left the app open for a while
    refetchOnWindowFocus: true,
  });
}
