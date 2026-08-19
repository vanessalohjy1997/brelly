import { render } from "@testing-library/react-native";

import {
  buildReadings,
  deriveLiveForecastText,
  LiveConditionsCard,
} from "@/components/weather/LiveConditionsCard";
import type { LiveConditions } from "@/types/weather";

const CONDITIONS: LiveConditions = {
  stationName: "Tanjong Rhu",
  observedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  rainfallMm: 1.4,
  temperatureC: 29.8,
  humidityPercent: 78.5,
  windSpeedKn: 6,
};

describe("buildReadings", () => {
  it("includes every reading that came back", () => {
    const labels = buildReadings(CONDITIONS, {
      value: 8,
      updatedAt: null,
    }).map((r) => r.label);

    expect(labels).toEqual(["Rain", "Temp", "Humidity", "Wind", "UV 8"]);
  });

  it("reports dry weather as 'None' rather than '0 mm'", () => {
    const readings = buildReadings({ ...CONDITIONS, rainfallMm: 0 }, undefined);
    expect(readings.find((r) => r.label === "Rain")?.value).toBe("None");
  });

  it("keeps a non-zero rainfall figure", () => {
    const readings = buildReadings(CONDITIONS, undefined);
    expect(readings.find((r) => r.label === "Rain")?.value).toBe("1.4 mm");
  });

  it("converts the station's knots to km/h", () => {
    const readings = buildReadings(CONDITIONS, undefined);
    expect(readings.find((r) => r.label === "Wind")?.value).toBe("11 km/h");
  });

  it("rounds temperature and humidity", () => {
    const readings = buildReadings(CONDITIONS, undefined);
    expect(readings.find((r) => r.label === "Temp")?.value).toBe("30°C");
    expect(readings.find((r) => r.label === "Humidity")?.value).toBe("79%");
  });

  it("bands the UV value", () => {
    const readings = buildReadings(undefined, { value: 11, updatedAt: null });

    expect(readings).toEqual([{ label: "UV 11", value: "Extreme" }]);
  });

  it("no longer reports PSI — it answers a different question than the umbrella", () => {
    const labels = buildReadings(CONDITIONS, { value: 8, updatedAt: null }).map(
      (r) => r.label,
    );

    expect(labels.some((label) => label.startsWith("PSI"))).toBe(false);
  });

  it("omits sensors that didn't report", () => {
    const labels = buildReadings(
      { stationName: "S", observedAt: "", rainfallMm: 0 },
      undefined,
    ).map((r) => r.label);

    expect(labels).toEqual(["Rain"]);
  });

  it("returns nothing when there's no data at all", () => {
    expect(buildReadings(null, undefined)).toEqual([]);
  });

  it("keeps a zero UV index, which is a real overnight reading", () => {
    const readings = buildReadings(null, { value: 0, updatedAt: null });
    expect(readings).toEqual([{ label: "UV 0", value: "Low" }]);
  });
});

describe("deriveLiveForecastText", () => {
  const noon = new Date("2024-01-01T12:00:00");
  const midnight = new Date("2024-01-01T00:00:00");

  it("calls out rain over time of day when it's actually raining", () => {
    expect(
      deriveLiveForecastText({ ...CONDITIONS, rainfallMm: 1.4 }, midnight),
    ).toBe("Rain");
  });

  it("reports fair daytime weather when dry during the day", () => {
    expect(deriveLiveForecastText({ ...CONDITIONS, rainfallMm: 0 }, noon)).toBe(
      "Fair (Day)",
    );
  });

  it("reports fair night weather when dry after dark", () => {
    expect(
      deriveLiveForecastText({ ...CONDITIONS, rainfallMm: 0 }, midnight),
    ).toBe("Fair (Night)");
  });

  it("returns null when there's no rainfall sensor at all, rather than guessing", () => {
    expect(
      deriveLiveForecastText({ ...CONDITIONS, rainfallMm: undefined }, noon),
    ).toBeNull();
    expect(deriveLiveForecastText(null, noon)).toBeNull();
  });
});

describe("LiveConditionsCard", () => {
  it("renders the readings with the station and how old they are", async () => {
    const view = await render(
      <LiveConditionsCard
        conditions={CONDITIONS}
        uvIndex={{ value: 8, updatedAt: null }}
      />,
    );

    expect(view.getByText("Right now")).toBeTruthy();
    expect(view.getByText("Tanjong Rhu · 6m ago")).toBeTruthy();
    expect(view.getByText("30°C")).toBeTruthy();
    // The band label always rides alongside the number — the WHO UV palette
    // runs green→red, which red-green colour blindness collapses.
    expect(view.getByText("UV 8")).toBeTruthy();
    expect(view.getByText("Very high")).toBeTruthy();
  });

  it("shows a rain icon when the sensor is reporting rainfall", async () => {
    const view = await render(
      <LiveConditionsCard
        conditions={{ ...CONDITIONS, rainfallMm: 1.4 }}
        uvIndex={undefined}
      />,
    );

    expect(view.getByTestId("symbol-rainy")).toBeTruthy();
  });

  it("renders nothing rather than an empty card when no reading came back", async () => {
    const view = await render(
      <LiveConditionsCard conditions={null} uvIndex={undefined} />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it("answers the umbrella question as a watermark when the sensor reports rain", async () => {
    const view = await render(
      <LiveConditionsCard
        conditions={{ ...CONDITIONS, rainfallMm: 1.4 }}
        uvIndex={undefined}
      />,
    );

    await view.findByLabelText("Umbrella — rain");
    expect(view.getByTestId("symbol-umbrella")).toBeTruthy();
  });

  it("shows no watermark when it's dry and UV doesn't call for one", async () => {
    const view = await render(
      <LiveConditionsCard
        conditions={{ ...CONDITIONS, rainfallMm: 0 }}
        uvIndex={{ value: 5, updatedAt: null }}
      />,
    );

    expect(view.queryByTestId("symbol-umbrella")).toBeNull();
    expect(view.queryByLabelText(/Umbrella —/)).toBeNull();
  });

  it("answers the sun half of the verdict from UV when it's dry", async () => {
    const view = await render(
      <LiveConditionsCard
        conditions={{ ...CONDITIONS, rainfallMm: 0 }}
        uvIndex={{ value: 9, updatedAt: null }}
      />,
    );

    await view.findByLabelText("Umbrella — sun");
    expect(view.getByTestId("symbol-umbrella")).toBeTruthy();
  });
});
