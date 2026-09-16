"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchUvIndex } from "@brelly/core";

export type UvIndex = {
  value: number | null;
  updatedAt: string | null;
};

/**
 * The island-wide UV index.
 *
 * Takes no region and no permission gate on purpose. NEA publishes a single UV
 * figure for Singapore, so this resolves for a user with no plans and no
 * location permission — which is exactly when the empty state needs something
 * to show. NEA republishes hourly, hence the hour-long `staleTime`.
 */
export function useUvIndex(enabled: boolean = true) {
  return useQuery<UvIndex>({
    queryKey: ["uvIndex"],
    queryFn: async () => {
      const reading = await fetchUvIndex();
      return { value: reading.value, updatedAt: reading.updatedTimestamp };
    },
    enabled,
    staleTime: 1000 * 60 * 60,
  });
}
