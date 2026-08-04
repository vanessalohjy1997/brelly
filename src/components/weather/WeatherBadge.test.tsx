import { fireEvent, render } from "@testing-library/react-native";

import {
  describeFreshness,
  WeatherBadge,
} from "@/components/weather/WeatherBadge";
import type { SlotForecast } from "@/services/weather";

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

describe("describeFreshness", () => {
  it("names the outlook tier rather than its age alone", () => {
    expect(describeFreshness("4day", "3h ago")).toBe("Outlook · 3h ago");
  });

  it("says a cached reading is offline and when it was saved", () => {
    expect(describeFreshness("cached", "20m ago")).toBe("Offline · saved 20m ago");
  });

  it("still says offline when the cache has no timestamp", () => {
    expect(describeFreshness("cached", null)).toBe("Offline");
  });

  it("reports a live reading's age plainly", () => {
    expect(describeFreshness("2hr", "4m ago")).toBe("Updated 4m ago");
  });

  it("says nothing when there's no age to report", () => {
    expect(describeFreshness("24hr", null)).toBeNull();
  });
});

describe("WeatherBadge", () => {
  it("shows a skeleton with its own label while loading", async () => {
    const view = await render(<WeatherBadge weather={undefined} isLoading />);

    expect(view.getByText("Checking the sky…")).toBeTruthy();
    expect(view.queryByText("No forecast")).toBeNull();
  });

  it("shows the weather behind the verdict — the verdict itself is the pill", async () => {
    const weather: SlotForecast = {
      forecast: "Thundery Showers",
      source: "24hr",
      temperature: { low: 25, high: 34 },
    };

    const view = await render(
      <WeatherBadge weather={weather} isLoading={false} uvIndex={3} />,
    );

    expect(view.getByText("Thundery Showers")).toBeTruthy();
    expect(view.getByText("25–34°C")).toBeTruthy();
    // Spelled out here it competed with the plan's own name; `VerdictPill`
    // carries it in the card's corner instead.
    expect(view.queryByText(/Umbrella —/)).toBeNull();
  });

  it("shows an umbrella in the rain, so the answer is still a picture", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Passing Showers", source: "2hr" }}
        isLoading={false}
        uvIndex={3}
      />,
    );

    expect(view.getByTestId("symbol-umbrella")).toBeTruthy();
    expect(view.getAllByTestId("symbol-water_drop").length).toBeGreaterThan(1);
    expect(view.queryByTestId("symbol-sunny")).toBeNull();
  });

  it("shows an umbrella under a sun when UV is what's driving it", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Fair (Day)", source: "24hr" }}
        isLoading={false}
        uvIndex={9}
      />,
    );

    expect(view.getByTestId("symbol-umbrella")).toBeTruthy();
    expect(view.getByTestId("symbol-sunny")).toBeTruthy();
  });

  it("shows no umbrella on a clear stop — the sky icon is the cue", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Partly Cloudy (Day)", source: "2hr" }}
        isLoading={false}
        uvIndex={4}
      />,
    );

    expect(view.queryByTestId("symbol-umbrella")).toBeNull();
    expect(view.getByTestId("symbol-partly_cloudy_day")).toBeTruthy();
  });

  it("draws both marks when both triggers fire", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Passing Showers", source: "2hr" }}
        isLoading={false}
        uvIndex={10}
      />,
    );

    expect(view.getAllByTestId("symbol-water_drop").length).toBeGreaterThan(0);
    expect(view.getByTestId("symbol-sunny")).toBeTruthy();
  });

  it("falls back to a rain-only verdict when there's no UV reading", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Light Rain", source: "2hr" }}
        isLoading={false}
      />,
    );

    expect(view.getByTestId("symbol-umbrella")).toBeTruthy();
    expect(view.queryByTestId("symbol-sunny")).toBeNull();
  });

  it("never shows wind — it doesn't feed the umbrella question", async () => {
    const weather: SlotForecast = {
      forecast: "Cloudy",
      source: "24hr",
      wind: { speed: { low: 10, high: 20 }, direction: "SE" },
    };

    const view = await render(<WeatherBadge weather={weather} isLoading={false} />);

    expect(view.queryByText(/km\/h/)).toBeNull();
    expect(view.queryByText(/SE/)).toBeNull();
  });

  it("shows how old the reading is", async () => {
    const weather: SlotForecast = {
      forecast: "Fair (Day)",
      source: "4day",
      updatedAt: minutesAgo(200),
    };

    const view = await render(<WeatherBadge weather={weather} isLoading={false} />);

    expect(view.getByText("Outlook · 3h ago")).toBeTruthy();
  });

  it("ages a cached reading from when it was stored", async () => {
    const weather: SlotForecast = {
      forecast: "Showers",
      source: "cached",
      // NEA issued this long ago; the app stored it 20 minutes ago. The
      // second number is the one that describes the app's view of the world.
      updatedAt: minutesAgo(600),
      cachedAt: minutesAgo(20),
    };

    const view = await render(<WeatherBadge weather={weather} isLoading={false} />);

    expect(view.getByText("Offline · saved 20m ago")).toBeTruthy();
  });

  it("no longer shows the raw API tier label", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Cloudy", source: "24hr", updatedAt: minutesAgo(5) }}
        isLoading={false}
      />,
    );

    expect(view.queryByText("Today")).toBeNull();
    expect(view.queryByText("4-day")).toBeNull();
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

    await fireEvent.press(view.getByText("Couldn't load · Retry"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not offer a retry when no handler is given", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Couldn't load forecast", source: "error" }}
        isLoading={false}
      />,
    );

    expect(view.getByText("Couldn't load")).toBeTruthy();
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

  it("does not invent a verdict from a missing-forecast placeholder", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Forecast unavailable", source: "unavailable" }}
        isLoading={false}
        uvIndex={9}
      />,
    );

    expect(view.queryByTestId("symbol-umbrella")).toBeNull();
    expect(view.queryByTestId("symbol-sunny")).toBeNull();
  });
});
