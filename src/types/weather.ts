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

export type NeaWind = {
  speed: { low: number; high: number }; // km/h
  direction: string; // compass abbreviation, e.g. "SSE"
};

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
  // The 2hr API snake-cases this one field (`update_timestamp`) where the
  // other endpoints camel-case it (`updatedTimestamp`) — normalized here.
  updatedTimestamp: string;
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
  wind: NeaWind;
};

// The 4-day endpoint stamps its update time on the enclosing record, not on
// each day's forecast, so it has to be carried alongside them.
export type FourDayOutlook = {
  updatedTimestamp: string;
  forecasts: FourDayForecast[];
};

// ─── Real-time station readings ───────────────────────────────────────────────
// Separate from the forecast endpoints: these are what sensors measured, not
// what NEA predicts. Each dataset returns the same {stations, readings} shape.

export type StationDataset =
  | "rainfall"
  | "air-temperature"
  | "relative-humidity"
  | "wind-speed";

export type WeatherStation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type StationReadings = {
  timestamp: string;
  stations: WeatherStation[];
  /** stationId → measured value, for the most recent reading batch. */
  values: Record<string, number>;
};

/** What the nearest station to a location is measuring right now. */
export type LiveConditions = {
  stationName: string;
  observedAt: string;
  rainfallMm?: number;
  temperatureC?: number;
  humidityPercent?: number;
  windSpeedKn?: number;
};

// ─── Air quality ──────────────────────────────────────────────────────────────

export type PsiReading = {
  updatedTimestamp: string;
  /** 24-hourly PSI per region — the headline number NEA publishes. */
  psi: Record<NeaRegion, number>;
  pm25: Record<NeaRegion, number>;
};

export type UvIndexReading = {
  updatedTimestamp: string;
  /** Most recent hourly UV index value, and the hour it was recorded for. */
  value: number;
  hour: string;
};
