import { render, screen } from "@testing-library/react";

import { Icons } from "../icons";
import { forecastToSymbol, WeatherIcon } from "./WeatherIcon";

describe("forecastToSymbol", () => {
  it("reads NEA's own vocabulary", () => {
    expect(forecastToSymbol("Thundery Showers")).toBe(Icons.thunder);
    expect(forecastToSymbol("Light Rain")).toBe(Icons.rain);
    expect(forecastToSymbol("Cloudy")).toBe(Icons.cloudy);
    expect(forecastToSymbol("Fair (Day)")).toBe(Icons.sunny);
    expect(forecastToSymbol("Windy")).toBe(Icons.windy);
    expect(forecastToSymbol("Hazy")).toBe(Icons.hazy);
  });

  it("tests 'partly' before the plain 'cloudy' match", () => {
    // Every NEA partly-cloudy string contains "cloudy" too, so the broader
    // match swallowed all of them and drew an overcast sky where the sun
    // belongs. The order of the tests is the fix.
    expect(forecastToSymbol("Partly Cloudy")).toBe(Icons.partlyCloudy);
    expect(forecastToSymbol("Partly Cloudy (Day)")).toBe(Icons.partlyCloudy);
  });

  it("draws the night half of the vocabulary after dark", () => {
    // A sun drawn at 9pm reads as wrong even when the words beside it are
    // right, and NEA tags exactly which strings mean night.
    expect(forecastToSymbol("Partly Cloudy (Night)")).toBe(
      Icons.partlyCloudyNight,
    );
    expect(forecastToSymbol("Fair (Night)")).toBe(Icons.clearNight);
  });

  it("falls back without inventing a condition", () => {
    expect(forecastToSymbol("Something unheard of")).toBe(Icons.partlyCloudy);
    expect(forecastToSymbol("Something unheard of (Night)")).toBe(
      Icons.partlyCloudyNight,
    );
  });

  it("matches the strings the Open-Meteo translator emits", () => {
    // `wmoCodeToForecastText` deliberately speaks NEA's vocabulary so that this
    // function keeps working for an overseas slot with no changes of its own.
    expect(forecastToSymbol("Light Rain")).toBe(Icons.rain);
    expect(forecastToSymbol("Thundery Showers")).toBe(Icons.thunder);
  });
});

describe("WeatherIcon", () => {
  it("draws the symbol for the forecast", () => {
    render(<WeatherIcon forecast="Moderate Rain" />);
    expect(screen.getByTestId(`icon-${Icons.rain}`)).toBeInTheDocument();
  });
});
