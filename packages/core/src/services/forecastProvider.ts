import { getOpenMeteoForecastForSlot } from "@/services/openMeteo";
import { getForecastForSlot, type SlotForecast } from "@/services/weather";
import type { NeaRegion } from "@/types/weather";
import type { WeatherProvider } from "@/utils/weatherProvider";

/**
 * The one place that branches by weather provider. Every forecast-fetching
 * call site must go through this rather than calling `getForecastForSlot`
 * (NEA) directly — a call site that reads `slot.neaRegion`/coordinates on
 * its own and skips this dispatcher will silently serve NEA's forecast for
 * an overseas slot.
 */
export async function getForecastForSlotByProvider(params: {
  provider: WeatherProvider;
  region: NeaRegion;
  latitude: number;
  longitude: number;
  slotStartTime: string;
}): Promise<SlotForecast> {
  const { provider, region, latitude, longitude, slotStartTime } = params;

  if (provider === "openMeteo") {
    return getOpenMeteoForecastForSlot(latitude, longitude, slotStartTime);
  }
  return getForecastForSlot(region, latitude, longitude, slotStartTime);
}
