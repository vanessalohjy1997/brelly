import { render, screen } from "@testing-library/react";

import type { LiveConditions } from "@brelly/core";

import {
  buildReadings,
  deriveLiveForecastText,
  LiveConditionsCard,
} from "./LiveConditionsCard";

/** Shaped like what `getLiveConditions` returns from NEA's station readings. */
const conditions: LiveConditions = {
  stationName: "Ang Mo Kio",
  observedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  rainfallMm: 0,
  temperatureC: 29.4,
  humidityPercent: 78.2,
  windSpeedKn: 6,
};

describe("deriveLiveForecastText", () => {
  it("reports rain from the sensor, which beats any forecast", () => {
    expect(
      deriveLiveForecastText({ ...conditions, rainfallMm: 1.2 }),
    ).toBe("Rain");
  });

  it("stays in NEA's vocabulary, day and night", () => {
    // Reused as `WeatherIcon`'s `forecast` prop, so the string has to be one
    // `forecastToSymbol` matches on.
    expect(
      deriveLiveForecastText(conditions, new Date("2026-09-15T10:00:00")),
    ).toBe("Fair (Day)");
    expect(
      deriveLiveForecastText(conditions, new Date("2026-09-15T22:00:00")),
    ).toBe("Fair (Night)");
  });

  it("returns null rather than guessing with no rainfall reading", () => {
    expect(
      deriveLiveForecastText({ ...conditions, rainfallMm: undefined }),
    ).toBeNull();
    expect(deriveLiveForecastText(null)).toBeNull();
  });
});

describe("buildReadings", () => {
  it("says 'None' rather than '0 mm' for a dry five minutes", () => {
    // The sensor reports a 5-minute accumulation, so a bare zero is noise
    // where a word is an answer.
    expect(buildReadings(conditions, undefined)).toContainEqual({
      label: "Rain",
      value: "None",
    });
  });

  it("reports actual rainfall in millimetres", () => {
    expect(
      buildReadings({ ...conditions, rainfallMm: 2.4 }, undefined),
    ).toContainEqual({ label: "Rain", value: "2.4 mm" });
  });

  it("rounds the readings that come back with decimals", () => {
    const readings = buildReadings(conditions, undefined);
    expect(readings).toContainEqual({ label: "Temp", value: "29°C" });
    expect(readings).toContainEqual({ label: "Humidity", value: "78%" });
  });

  it("omits a reading that did not come back rather than showing a dash", () => {
    const readings = buildReadings(
      { stationName: "Ang Mo Kio", observedAt: conditions.observedAt },
      undefined,
    );
    expect(readings).toEqual([]);
  });

  it("carries the UV band in words as well as in the number", () => {
    // The WHO palette runs green→red, the axis red-green colour blindness
    // collapses, so the label has to ride alongside.
    expect(buildReadings(conditions, { value: 9, updatedAt: null })).toContainEqual(
      expect.objectContaining({ label: "UV 9" }),
    );
  });
});

describe("LiveConditionsCard", () => {
  it("renders nothing rather than a card full of dashes", () => {
    const { container } = render(
      <LiveConditionsCard conditions={null} uvIndex={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the station and how long ago it read", () => {
    render(<LiveConditionsCard conditions={conditions} uvIndex={undefined} />);

    expect(screen.getByText(/Ang Mo Kio/)).toHaveTextContent("6m ago");
    expect(
      screen.getByRole("heading", { name: "Right now" }),
    ).toBeInTheDocument();
  });

  it("pairs each number with its name for a screen reader", () => {
    render(<LiveConditionsCard conditions={conditions} uvIndex={undefined} />);

    expect(screen.getByText("29°C")).toBeInTheDocument();
    expect(screen.getByText("Temp")).toBeInTheDocument();
  });

  it("asks the umbrella question of the live reading", () => {
    render(
      <LiveConditionsCard
        conditions={{ ...conditions, rainfallMm: 3 }}
        uvIndex={undefined}
      />,
    );
    expect(screen.getByTestId("umbrella-verdict-rain")).toBeInTheDocument();
  });

  it("draws no watermark for a clear reading", () => {
    render(<LiveConditionsCard conditions={conditions} uvIndex={undefined} />);
    expect(screen.queryByTestId(/umbrella-verdict/)).not.toBeInTheDocument();
  });
});
