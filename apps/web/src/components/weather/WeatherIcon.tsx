import { Icon } from "../Icon";
import { Icons, type IconName } from "../icons";
import type { IconSize } from "@/constants/theme";

/**
 * Maps NEA forecast text ("Afternoon Thundery Showers") to a symbol.
 *
 * A verbatim port of the phone's `forecastToSymbol`, and the order of the tests
 * is load-bearing — see the "partly" case. Exported so the mapping can be
 * checked directly: it is pure string matching against a fixed vocabulary.
 *
 * This is also what `wmoWeatherCode.ts` exists to keep working. Open-Meteo
 * reports a numeric WMO code rather than English, and its translator emits
 * strings in *NEA's* vocabulary precisely so that this function, the packing
 * list and the rain-alert rule all keep working with no changes of their own.
 */
export function forecastToSymbol(forecast: string): IconName {
  const f = forecast.toLowerCase();
  // NEA tags the half of its vocabulary that differs after dark: "Partly
  // Cloudy (Night)", "Fair (Night)". A sun drawn at 9pm reads as wrong even
  // when the words beside it are right.
  const night = f.includes("night");

  if (f.includes("thunder")) return Icons.thunder;
  if (f.includes("rain") || f.includes("shower")) return Icons.rain;
  // Before the plain "cloudy" test, not after it: every NEA partly-cloudy
  // string contains "cloudy" too, so the broader match was swallowing all of
  // them and drawing an overcast sky where the sun belongs.
  if (f.includes("partly"))
    return night ? Icons.partlyCloudyNight : Icons.partlyCloudy;
  if (f.includes("cloudy")) return Icons.cloudy;
  if (f.includes("fair") || f.includes("sunny") || f.includes("clear"))
    return night ? Icons.clearNight : Icons.sunny;
  if (f.includes("windy") || f.includes("breezy")) return Icons.windy;
  if (f.includes("hazy") || f.includes("mist") || f.includes("fog"))
    return Icons.hazy;
  return night ? Icons.partlyCloudyNight : Icons.partlyCloudy;
}

export function WeatherIcon({
  forecast,
  size = "controlEmphasis",
  className,
}: {
  forecast: string;
  size?: keyof typeof IconSize;
  className?: string;
}) {
  return (
    <Icon name={forecastToSymbol(forecast)} size={size} className={className} />
  );
}
