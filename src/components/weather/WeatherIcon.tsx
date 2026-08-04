import { Icon, type IconName } from "@/components/icon";

type Props = {
  forecast: string;
  size?: number;
  tintColor?: string;
};

const THUNDER: IconName = { ios: "cloud.bolt.rain.fill", android: "thunderstorm" };
const RAIN: IconName = { ios: "cloud.rain.fill", android: "rainy" };
const CLOUDY: IconName = { ios: "cloud.fill", android: "cloud" };
const PARTLY_CLOUDY: IconName = { ios: "cloud.sun.fill", android: "partly_cloudy_day" };
const PARTLY_CLOUDY_NIGHT: IconName = {
  ios: "cloud.moon.fill",
  android: "partly_cloudy_night",
};
const SUNNY: IconName = { ios: "sun.max.fill", android: "sunny" };
const CLEAR_NIGHT: IconName = { ios: "moon.stars.fill", android: "moon_stars" };
const WINDY: IconName = { ios: "wind", android: "air" };
const HAZY: IconName = { ios: "cloud.fog.fill", android: "foggy" };
const DEFAULT: IconName = PARTLY_CLOUDY;

/**
 * Maps NEA forecast text (e.g. "Afternoon Thundery Showers") to a symbol.
 *
 * Exported so the mapping can be checked directly — it is pure string
 * matching against a fixed vocabulary, and the order of the tests is load
 * bearing.
 */
export function forecastToSymbol(forecast: string): IconName {
  const f = forecast.toLowerCase();
  // NEA tags the half of its vocabulary that differs after dark: "Partly
  // Cloudy (Night)", "Fair (Night)". A sun drawn at 9pm reads as wrong even
  // when the words beside it are right.
  const night = f.includes("night");

  if (f.includes("thunder")) return THUNDER;
  if (f.includes("rain") || f.includes("shower")) return RAIN;
  // Before the plain "cloudy" test, not after it: every NEA partly-cloudy
  // string contains "cloudy" too, so the broader match was swallowing all of
  // them and drawing an overcast sky where the sun belongs.
  if (f.includes("partly")) return night ? PARTLY_CLOUDY_NIGHT : PARTLY_CLOUDY;
  if (f.includes("cloudy")) return CLOUDY;
  if (f.includes("fair") || f.includes("sunny") || f.includes("clear"))
    return night ? CLEAR_NIGHT : SUNNY;
  if (f.includes("windy") || f.includes("breezy")) return WINDY;
  if (f.includes("hazy") || f.includes("mist") || f.includes("fog"))
    return HAZY;
  return night ? PARTLY_CLOUDY_NIGHT : DEFAULT;
}

export function WeatherIcon({ forecast, size = 24, tintColor }: Props) {
  return <Icon name={forecastToSymbol(forecast)} size={size} tintColor={tintColor} />;
}
