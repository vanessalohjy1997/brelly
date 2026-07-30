import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";

type Props = {
  forecast: string;
  size?: number;
  tintColor?: string;
};

type WeatherSymbol = {
  ios: SFSymbol;
  android: AndroidSymbol;
};

const THUNDER: WeatherSymbol = { ios: "cloud.bolt.rain.fill", android: "thunderstorm" };
const RAIN: WeatherSymbol = { ios: "cloud.rain.fill", android: "rainy" };
const CLOUDY: WeatherSymbol = { ios: "cloud.fill", android: "cloud" };
const PARTLY_CLOUDY: WeatherSymbol = { ios: "cloud.sun.fill", android: "partly_cloudy_day" };
const SUNNY: WeatherSymbol = { ios: "sun.max.fill", android: "sunny" };
const WINDY: WeatherSymbol = { ios: "wind", android: "air" };
const HAZY: WeatherSymbol = { ios: "cloud.fog.fill", android: "foggy" };
const DEFAULT: WeatherSymbol = PARTLY_CLOUDY;

// Maps NEA forecast text (e.g. "Afternoon Thundery Showers") to a symbol.
function forecastToSymbol(forecast: string): WeatherSymbol {
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
  const symbol = forecastToSymbol(forecast);

  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={size}
      tintColor={tintColor}
      type="hierarchical"
    />
  );
}
