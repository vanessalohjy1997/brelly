export type WeatherForecast = {
  region: string;
  forecast: string; // e.g. "Afternoon Thundery Showers"
  temperature: {
    low: number;
    high: number;
  };
  humidity: {
    low: number;
    high: number;
  };
  validPeriod: {
    start: string;
    end: string;
  };
};

export type NeaRegion = "north" | "south" | "east" | "west" | "central";

// NEA's API nests every forecast string as { code, text } — never a bare string.
export type NeaForecastText = {
  code: string;
  text: string;
};

export type TwentyFourHrPeriod = {
  timePeriod: {
    start: string; // ISO string
    end: string;
  };
  regions: Record<NeaRegion, NeaForecastText>;
};

export type TwentyFourHrForecast = {
  date: string;
  updatedTimestamp: string;
  general: {
    forecast: NeaForecastText;
    relativeHumidity: { low: number; high: number };
    temperature: { low: number; high: number };
    wind: { speed: { low: number; high: number }; direction: string };
  };
  periods: TwentyFourHrPeriod[];
};

export type TwoHrArea = {
  name: string; // e.g. "Yio Chu Kang", "Tanjong Pagar"
  forecast: string; // e.g. "Partly Cloudy"
};

// Coordinates NEA uses to label each area — lets us match a slot's lat/lng
// to the nearest NEA area rather than relying on name matching.
export type NeaAreaMetadata = {
  name: string;
  latitude: number;
  longitude: number;
};

export type TwoHrForecast = {
  timestamp: string;
  validPeriod: { start: string; end: string };
  areas: TwoHrArea[];
  areaMetadata: NeaAreaMetadata[];
};

export type FourDayForecast = {
  timestamp: string; // ISO date this forecast is for
  day: string; // e.g. "Friday"
  forecast: NeaForecastText;
  temperature: { low: number; high: number };
  relativeHumidity: { low: number; high: number };
  wind: { speed: { low: number; high: number }; direction: string };
};
