import { fireEvent, render } from "@testing-library/react-native";

import { WeatherBadge } from "@/components/weather/WeatherBadge";
import type { SlotForecast } from "@/services/weather";

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

describe("WeatherBadge", () => {
  it("shows a spinner while loading", async () => {
    const view = await render(<WeatherBadge weather={undefined} isLoading />);
    expect(view.toJSON()).toBeTruthy();
    expect(view.queryByText("No forecast")).toBeNull();
  });

  it("shows the forecast, tier and temperature", async () => {
    const weather: SlotForecast = {
      forecast: "Thundery Showers",
      source: "24hr",
      temperature: { low: 25, high: 34 },
    };

    const view = await render(<WeatherBadge weather={weather} isLoading={false} />);

    expect(view.getByText("Thundery Showers")).toBeTruthy();
    expect(view.getByText("Today")).toBeTruthy();
    expect(view.getByText("25–34°C")).toBeTruthy();
  });

  it("shows wind when the tier carries it", async () => {
    const weather: SlotForecast = {
      forecast: "Cloudy",
      source: "24hr",
      wind: { speed: { low: 10, high: 20 }, direction: "SE" },
    };

    const view = await render(<WeatherBadge weather={weather} isLoading={false} />);

    expect(view.getByText("SE 10–20 km/h")).toBeTruthy();
  });

  it("omits wind for a 2hr nowcast, which doesn't report it", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Partly Cloudy", source: "2hr" }}
        isLoading={false}
      />,
    );

    expect(view.queryByText(/km\/h/)).toBeNull();
  });

  it("shows how old the reading is", async () => {
    const weather: SlotForecast = {
      forecast: "Fair (Day)",
      source: "4day",
      updatedAt: minutesAgo(200),
    };

    const view = await render(<WeatherBadge weather={weather} isLoading={false} />);

    expect(view.getByText("Updated 3h ago")).toBeTruthy();
  });

  it("labels a cached reading as offline and ages it from when it was stored", async () => {
    const weather: SlotForecast = {
      forecast: "Showers",
      source: "cached",
      // NEA issued this long ago; the app stored it 20 minutes ago. The
      // second number is the one that describes the app's view of the world.
      updatedAt: minutesAgo(600),
      cachedAt: minutesAgo(20),
    };

    const view = await render(<WeatherBadge weather={weather} isLoading={false} />);

    expect(view.getByText("Offline")).toBeTruthy();
    expect(view.getByText("Updated 20m ago")).toBeTruthy();
  });

  it("offers a retry when the request failed", async () => {
    const onRetry = jest.fn();
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Couldn't load forecast", source: "error" }}
        isLoading={false}
        onRetry={onRetry}
      />,
    );

    await fireEvent.press(view.getByText("Couldn't load forecast · Retry"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not offer a retry when no handler is given", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Couldn't load forecast", source: "error" }}
        isLoading={false}
      />,
    );

    expect(view.getByText("Couldn't load forecast")).toBeTruthy();
    expect(view.queryByText(/Retry/)).toBeNull();
  });

  it("shows 'No forecast' — with no retry — when NEA simply has no entry", async () => {
    const onRetry = jest.fn();
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Forecast unavailable", source: "unavailable" }}
        isLoading={false}
        onRetry={onRetry}
      />,
    );

    expect(view.getByText("No forecast")).toBeTruthy();
    expect(view.queryByText(/Retry/)).toBeNull();
  });
});
