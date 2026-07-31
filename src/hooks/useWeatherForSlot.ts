import { useQuery } from "@tanstack/react-query";

import { getForecastForSlot } from "@/services/weather";
import { mmkvStorage } from "@/store/mmkvStorage";
import { NeaRegion } from "@/types/weather";
import {
  forecastCacheKey,
  readCachedForecast,
  writeCachedForecast,
} from "@/utils/forecastCache";

type Params = {
  region: NeaRegion;
  latitude: number;
  longitude: number;
  slotStartTime: string; // ISO string
};

export function useWeatherForSlot({
  region,
  latitude,
  longitude,
  slotStartTime,
}: Params) {
  return useQuery({
    queryKey: ["weather", region, latitude, longitude, slotStartTime],
    queryFn: async () => {
      const cacheKey = forecastCacheKey({ latitude, longitude, slotStartTime });
      const forecast = await getForecastForSlot(
        region,
        latitude,
        longitude,
        slotStartTime,
      );

      // `getForecastForSlot` reports a failed request as `source: "error"`
      // rather than throwing, so React Query's own retry/error path never
      // sees it — the offline fallback has to happen here.
      if (forecast.source === "error") {
        const cached = readCachedForecast(mmkvStorage, cacheKey);
        if (cached) return cached;
        return forecast;
      }

      writeCachedForecast(mmkvStorage, cacheKey, forecast);
      return forecast;
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!region && !!slotStartTime,
    // Refetch automatically when the app comes back to the foreground
    // so forecasts update if the user left the app open for a while
    refetchOnWindowFocus: true,
  });
}
