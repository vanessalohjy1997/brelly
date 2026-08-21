import { fireEvent, render } from "@testing-library/react-native";

import {
  describeFreshness,
  ForecastTimestamp,
  WeatherBadge,
} from "@/components/weather/WeatherBadge";
import type { SlotForecast } from "@/services/weather";
import { describeUmbrella } from "@/utils/describeUmbrella";

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

  it("names the Open-Meteo outlook tier the same way as NEA's 4-day tier", () => {
    expect(describeFreshness("openMeteoDaily", "2h ago")).toBe("Outlook · 2h ago");
  });

  it("reports an Open-Meteo hourly reading's age plainly", () => {
    expect(describeFreshness("openMeteoHourly", "10m ago")).toBe("Updated 10m ago");
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

  it("shows the weather behind the verdict — the verdict itself is the card's icon watermark", async () => {
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
    // Spelled out visibly here it would compete with the plan's own name;
    // `ItineraryCard`'s watermark carries it instead, and the sentence
    // survives for screen readers as the field's accessibility label.
    expect(view.queryByText(/Umbrella —/)).toBeNull();
  });

  it("speaks the full rain verdict for a screen reader", async () => {
    const verdict = describeUmbrella("Passing Showers", 3);
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Passing Showers", source: "2hr" }}
        isLoading={false}
        uvIndex={3}
      />,
    );

    expect(
      view.getByLabelText(new RegExp(`^${verdict.label}\\. `)),
    ).toBeTruthy();
  });

  it("speaks the sun verdict when UV is what's driving it", async () => {
    const verdict = describeUmbrella("Fair (Day)", 9);
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Fair (Day)", source: "24hr" }}
        isLoading={false}
        uvIndex={9}
      />,
    );

    expect(
      view.getByLabelText(new RegExp(`^${verdict.label}\\. `)),
    ).toBeTruthy();
  });

  it("still speaks the verdict on a clear stop, just with nothing to tint", async () => {
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Partly Cloudy (Day)", source: "2hr" }}
        isLoading={false}
        uvIndex={4}
      />,
    );

    expect(view.getByLabelText(/^You're clear\. /)).toBeTruthy();
  });

  it("names both triggers when both fire", async () => {
    const verdict = describeUmbrella("Passing Showers", 10);
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Passing Showers", source: "2hr" }}
        isLoading={false}
        uvIndex={10}
      />,
    );

    expect(
      view.getByLabelText(new RegExp(`^${verdict.label}\\. `)),
    ).toBeTruthy();
  });

  it("falls back to a rain-only verdict when there's no UV reading", async () => {
    const verdict = describeUmbrella("Light Rain", null);
    const view = await render(
      <WeatherBadge
        weather={{ forecast: "Light Rain", source: "2hr" }}
        isLoading={false}
      />,
    );

    expect(
      view.getByLabelText(new RegExp(`^${verdict.label}\\. `)),
    ).toBeTruthy();
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

  it.each([
    ["an outlook", "4day" as const, "Outlook · 3h ago"],
    ["a cached", "cached" as const, "Offline · saved 3h ago"],
    ["a live", "2hr" as const, "4m ago"],
  ])(
    "shows no age of its own for %s reading — every one of them moved to ForecastTimestamp",
    async (_name, source, text) => {
      const weather: SlotForecast = {
        forecast: "Fair (Day)",
        source,
        updatedAt: minutesAgo(200),
        cachedAt: minutesAgo(200),
      };

      const view = await render(
        <WeatherBadge weather={weather} isLoading={false} />,
      );

      expect(view.queryByText(text)).toBeNull();
      expect(view.queryByText(/ago/)).toBeNull();
    },
  );

  it("leaves freshness out of its spoken sentence — ForecastTimestamp speaks its own", async () => {
    const weather: SlotForecast = {
      forecast: "Fair (Day)",
      source: "2hr",
      updatedAt: minutesAgo(4),
    };

    const view = await render(<WeatherBadge weather={weather} isLoading={false} />);

    expect(view.queryByLabelText(/Updated 4m ago/)).toBeNull();
    expect(view.getByLabelText(/Fair \(Day\)/)).toBeTruthy();
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

    // The unavailable branch returns before any verdict is computed at all —
    // nothing here to tint or speak a sentence about.
    expect(view.queryByLabelText(/Umbrella —/)).toBeNull();
    expect(view.queryByLabelText(/You're clear/)).toBeNull();
  });
});

describe("ForecastTimestamp", () => {
  it("shows a live reading's age", async () => {
    const weather: SlotForecast = {
      forecast: "Fair (Day)",
      source: "2hr",
      updatedAt: minutesAgo(4),
    };

    const view = await render(<ForecastTimestamp weather={weather} />);

    expect(view.getByText("4m ago")).toBeTruthy();
  });

  it("spells out a cached reading rather than reducing it to a bare age — it isn't 'updated', it's saved", async () => {
    const weather: SlotForecast = {
      forecast: "Showers",
      source: "cached",
      cachedAt: minutesAgo(20),
    };

    const view = await render(<ForecastTimestamp weather={weather} />);

    expect(view.getByText("Offline · saved 20m ago")).toBeTruthy();
  });

  it("spells out an outlook reading — same reason, and the same corner", async () => {
    const weather: SlotForecast = {
      forecast: "Fair (Day)",
      source: "4day",
      updatedAt: minutesAgo(200),
    };

    const view = await render(<ForecastTimestamp weather={weather} />);

    expect(view.getByText("Outlook · 3h ago")).toBeTruthy();
  });

  it("puts an NEA outlook and an Open-Meteo hourly reading in the same corner", async () => {
    // The bug this replaced: which tier answers is decided by geography, so
    // a Singapore plan two days out (NEA "4day") and an overseas one at the
    // same distance (Open-Meteo, hourly for a week) rendered their age in
    // two different places on an otherwise identical card.
    const nea = await render(
      <ForecastTimestamp
        weather={{ forecast: "Fair (Day)", source: "4day", updatedAt: minutesAgo(60) }}
      />,
    );
    const openMeteo = await render(
      <ForecastTimestamp
        weather={{
          forecast: "Fair (Day)",
          source: "openMeteoHourly",
          updatedAt: minutesAgo(60),
        }}
      />,
    );

    expect(nea.getByText(/1h ago/)).toBeTruthy();
    expect(openMeteo.getByText(/1h ago/)).toBeTruthy();
  });

  it("speaks the whole freshness sentence even where the clock icon stands in for 'Updated'", async () => {
    const weather: SlotForecast = {
      forecast: "Fair (Day)",
      source: "2hr",
      updatedAt: minutesAgo(4),
    };

    const view = await render(<ForecastTimestamp weather={weather} />);

    expect(view.getByLabelText("Updated 4m ago")).toBeTruthy();
  });

  it("says nothing when there is no forecast to have an age", async () => {
    const view = await render(<ForecastTimestamp weather={undefined} />);

    expect(view.toJSON()).toBeNull();
  });
});
