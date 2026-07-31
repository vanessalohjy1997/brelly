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
const SUNNY: IconName = { ios: "sun.max.fill", android: "sunny" };
const WINDY: IconName = { ios: "wind", android: "air" };
const HAZY: IconName = { ios: "cloud.fog.fill", android: "foggy" };
const DEFAULT: IconName = PARTLY_CLOUDY;

// Maps NEA forecast text (e.g. "Afternoon Thundery Showers") to a symbol.
function forecastToSymbol(forecast: string): IconName {
  const f = forecast.toLowerCase();
  if (f.includes("thunder")) return THUNDER;
  if (f.includes("rain") || f.includes("shower")) return RAIN;
  if (f.includes("cloudy")) return CLOUDY;
  if (f.includes("partly")) return PARTLY_CLOUDY;
  if (f.includes("fair") || f.includes("sunny") || f.includes("clear"))
    return SUNNY;
  if (f.includes("windy") || f.includes("breezy")) return WINDY;
  if (f.includes("hazy") || f.includes("mist") || f.includes("fog"))
    return HAZY;
  return DEFAULT;
}

export function WeatherIcon({ forecast, size = 24, tintColor }: Props) {
  return <Icon name={forecastToSymbol(forecast)} size={size} tintColor={tintColor} />;
}
