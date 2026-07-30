import { getForecastForSlot } from "@/services/weather";
import { NeaRegion } from "@/types/weather";
import { useQuery } from "@tanstack/react-query";

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
    queryFn: () =>
      getForecastForSlot(region, latitude, longitude, slotStartTime),
    staleTime: 1000 * 60 * 10,
    enabled: !!region && !!slotStartTime,
    // Refetch automatically when the app comes back to the foreground
    // so forecasts update if the user left the app open for a while
    refetchOnWindowFocus: true,
  });
}
