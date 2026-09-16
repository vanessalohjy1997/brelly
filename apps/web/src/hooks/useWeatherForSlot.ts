"use client";

import { useQuery } from "@tanstack/react-query";

import {
  forecastCacheKey,
  getForecastForSlotByProvider,
  readCachedForecast,
  writeCachedForecast,
  type NeaRegion,
  type WeatherProvider,
} from "@brelly/core";
import { webStorage } from "@/store/webStorage";

type Params = {
  provider: WeatherProvider;
  region: NeaRegion;
  latitude: number;
  longitude: number;
  slotStartTime: string; // ISO string
  /**
   * Off for a stop that has already finished. Neither provider serves history,
   * so the request can only come back as "unavailable" — and an archive of a
   * hundred past stops would fire a hundred of them to render a hundred "No
   * forecast" lines.
   */
  enabled?: boolean;
};

/**
 * Identical to the phone's hook but for the storage it caches into, which is
 * the seam working rather than a coincidence: `forecastCache` declares its
 * `CacheStorage` as `{ getItem, setItem }` structurally, and `localStorage`
 * satisfies it verbatim.
 */
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
      // coordinate+time only, with no provider component, but that is safe: a
      // given coordinate pair deterministically maps to one provider.
      if (forecast.source === "error") {
        const cached = readCachedForecast(webStorage, cacheKey);
        if (cached) return cached;
        return forecast;
      }

      writeCachedForecast(webStorage, cacheKey, forecast);
      return forecast;
    },
    staleTime: 1000 * 60 * 10,
    enabled: enabled && !!region && !!slotStartTime,
    refetchOnWindowFocus: true,
  });
}
