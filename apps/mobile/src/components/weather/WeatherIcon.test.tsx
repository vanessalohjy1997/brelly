import { render } from "@testing-library/react-native";

import { forecastToSymbol, WeatherIcon } from "@/components/weather/WeatherIcon";

// Every string below is NEA vocabulary, taken from the 2hr and 24hr
// endpoints' documented forecast set rather than invented.
describe("forecastToSymbol", () => {
  it("draws thunder before rain for a thundery shower", () => {
    expect(forecastToSymbol("Heavy Thundery Showers").android).toBe(
      "thunderstorm",
    );
  });

  it("draws rain for every shower wording", () => {
    expect(forecastToSymbol("Passing Showers").android).toBe("rainy");
    expect(forecastToSymbol("Light Rain").android).toBe("rainy");
  });

  it("keeps the sun in partly cloudy, which the plain cloud match ate", () => {
    expect(forecastToSymbol("Partly Cloudy (Day)").android).toBe(
      "partly_cloudy_day",
    );
  });

  it("still draws a full cloud for overcast", () => {
    expect(forecastToSymbol("Cloudy").android).toBe("cloud");
  });

  it("swaps the sun for a moon after dark", () => {
    expect(forecastToSymbol("Partly Cloudy (Night)").android).toBe(
      "partly_cloudy_night",
    );
    expect(forecastToSymbol("Fair (Night)").android).toBe("moon_stars");
  });

  it("draws a sun for a fair or clear day", () => {
    expect(forecastToSymbol("Fair (Day)").android).toBe("sunny");
    expect(forecastToSymbol("Fair & Warm").android).toBe("sunny");
  });

  it("draws haze and wind for their own wordings", () => {
    expect(forecastToSymbol("Slightly Hazy").android).toBe("foggy");
    expect(forecastToSymbol("Windy").android).toBe("air");
  });

  it("falls back without inventing a sun at night", () => {
    expect(forecastToSymbol("Something New").android).toBe("partly_cloudy_day");
    expect(forecastToSymbol("Something New (Night)").android).toBe(
      "partly_cloudy_night",
    );
  });
});

describe("WeatherIcon", () => {
  it("renders the symbol its forecast maps to", async () => {
    const view = await render(<WeatherIcon forecast="Thundery Showers" />);

    expect(view.getByTestId("symbol-thunderstorm")).toBeTruthy();
  });
});
