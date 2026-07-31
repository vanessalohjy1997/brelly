import { useQuery } from "@tanstack/react-query";

import { getLiveConditions } from "@/services/liveConditions";

/**
 * What the sensors nearest a point are measuring right now.
 *
 * Kept on a much shorter `staleTime` than the forecast queries: these are
 * live readings updated every few minutes, and the question they answer
 * ("is it raining on me?") goes stale just as fast.
 */
export function useLiveConditions(
  latitude: number | null,
  longitude: number | null,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["liveConditions", latitude, longitude],
    queryFn: () => getLiveConditions(latitude as number, longitude as number),
    enabled: enabled && latitude !== null && longitude !== null,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
}
