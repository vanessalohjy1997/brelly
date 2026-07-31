import { render } from "@testing-library/react-native";

import {
  buildReadings,
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
      psi: 57,
      uvIndex: 8,
      updatedAt: null,
    }).map((r) => r.label);

    expect(labels).toEqual([
      "Rain",
      "Temp",
      "Humidity",
      "Wind",
      "PSI 57",
      "UV 8",
    ]);
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

  it("bands the PSI and UV values", () => {
    const readings = buildReadings(undefined, {
      psi: 150,
      uvIndex: 11,
      updatedAt: null,
    });

    expect(readings).toEqual([
      { label: "PSI 150", value: "Unhealthy" },
      { label: "UV 11", value: "Extreme" },
    ]);
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
    const readings = buildReadings(null, { psi: null, uvIndex: 0, updatedAt: null });
    expect(readings).toEqual([{ label: "UV 0", value: "Low" }]);
  });
});

describe("LiveConditionsCard", () => {
  it("renders the readings with the station and how old they are", async () => {
    const view = await render(
      <LiveConditionsCard
        conditions={CONDITIONS}
        airQuality={{ psi: 57, uvIndex: 8, updatedAt: null }}
      />,
    );

    expect(view.getByText("Right now")).toBeTruthy();
    expect(view.getByText("Tanjong Rhu · 6m ago")).toBeTruthy();
    expect(view.getByText("30°C")).toBeTruthy();
    // PSI 57 bands as Moderate; UV 8 as Very high.
    expect(view.getByText("Moderate")).toBeTruthy();
    expect(view.getByText("Very high")).toBeTruthy();
  });

  it("renders nothing rather than an empty card when no reading came back", async () => {
    const view = await render(
      <LiveConditionsCard conditions={null} airQuality={undefined} />,
    );

    expect(view.toJSON()).toBeNull();
  });
});
