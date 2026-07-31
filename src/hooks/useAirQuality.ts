import { useQuery } from "@tanstack/react-query";

import { fetchPsi, fetchUvIndex } from "@/services/airQuality";
import type { NeaRegion } from "@/types/weather";

export type AirQuality = {
  psi: number | null;
  uvIndex: number | null;
  updatedAt: string | null;
};

/**
 * PSI for a region plus the island-wide UV index.
 *
 * The two are fetched together because they answer one question — "is it fine
 * to be outside?" — but independently enough that one failing shouldn't
 * blank the other. NEA republishes both hourly, hence the hour-long
 * `staleTime`.
 */
export function useAirQuality(region: NeaRegion | null, enabled: boolean = true) {
  return useQuery<AirQuality>({
    queryKey: ["airQuality", region],
    queryFn: async () => {
      const [psi, uv] = await Promise.allSettled([fetchPsi(), fetchUvIndex()]);

      return {
        psi:
          psi.status === "fulfilled" && region ? psi.value.psi[region] ?? null : null,
        uvIndex: uv.status === "fulfilled" ? uv.value.value : null,
        updatedAt:
          psi.status === "fulfilled"
            ? psi.value.updatedTimestamp
            : uv.status === "fulfilled"
              ? uv.value.updatedTimestamp
              : null,
      };
    },
    enabled: enabled && region !== null,
    staleTime: 1000 * 60 * 60,
  });
}
