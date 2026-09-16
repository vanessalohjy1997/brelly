import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SlotForecast } from "@brelly/core";

import {
  describeFreshness,
  ForecastTimestamp,
  WeatherBadge,
} from "./WeatherBadge";

/** A shape taken from what `getForecastForSlotByProvider` actually returns. */
const forecast: SlotForecast = {
  forecast: "Thundery Showers",
  source: "2hr",
  updatedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  temperature: { low: 26, high: 31 },
};

describe("WeatherBadge", () => {
  it("holds the badge's height while loading, so cards do not resize", () => {
    render(<WeatherBadge weather={undefined} isLoading />);
    expect(screen.getByText("Checking the sky…")).toBeInTheDocument();
  });

  it("offers a retry for a failed request", () => {
    // "error" is the request itself failing, so a retry can plausibly succeed.
    render(
      <WeatherBadge
        weather={{ ...forecast, source: "error" }}
        isLoading={false}
        onRetry={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Retry/ }),
    ).toBeInTheDocument();
  });

  it("runs the retry", async () => {
    const onRetry = jest.fn();
    render(
      <WeatherBadge
        weather={{ ...forecast, source: "error" }}
        isLoading={false}
        onRetry={onRetry}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("offers no retry when there is nothing to retry into", () => {
    render(
      <WeatherBadge weather={{ ...forecast, source: "error" }} isLoading={false} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn’t load/)).toBeInTheDocument();
  });

  it("says 'No forecast' for a time the provider does not cover", () => {
    // "unavailable" is not a failure — there is nothing to retry.
    render(
      <WeatherBadge
        weather={{ ...forecast, source: "unavailable" }}
        isLoading={false}
      />,
    );
    expect(screen.getByText("No forecast")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("leads with the umbrella answer in a word", () => {
    render(<WeatherBadge weather={forecast} isLoading={false} />);

    expect(screen.getByText("Thundery Showers")).toBeInTheDocument();
    expect(screen.getByText("26–31°C")).toBeInTheDocument();
  });

  it("stays wordless about umbrellas when the stop is clear", () => {
    // The same restraint the card applies to the accent bar and the watermark.
    render(
      <WeatherBadge
        weather={{ ...forecast, forecast: "Fair (Day)" }}
        isLoading={false}
        uvIndex={2}
      />,
    );
    expect(screen.queryByText(/^Rain/)).not.toBeInTheDocument();
    expect(screen.getByText("Fair (Day)")).toBeInTheDocument();
  });

  it("gives a screen reader one sentence, not three fragments", () => {
    const { container } = render(
      <WeatherBadge weather={forecast} isLoading={false} />,
    );

    const spoken = container.querySelector(".sr-only");
    expect(spoken?.textContent).toContain("Thundery Showers");
    expect(spoken?.textContent).toContain("26–31°C");
  });
});

describe("describeFreshness", () => {
  it("names the tier rather than the age for a longer-range reading", () => {
    // Which tier answered is decided by geography, and how far a reading is
    // being stretched matters more than how old it is.
    expect(describeFreshness("4day", "1h ago")).toBe("Outlook · 1h ago");
    expect(describeFreshness("openMeteoDaily", "3h ago")).toBe("Outlook · 3h ago");
  });

  it("says a cached reading came off disk", () => {
    expect(describeFreshness("cached", "2h ago")).toBe("Offline · saved 2h ago");
    expect(describeFreshness("cached", null)).toBe("Offline");
  });

  it("gives a live reading its age", () => {
    expect(describeFreshness("2hr", "4m ago")).toBe("Updated 4m ago");
  });

  it("says nothing when there is no age to report", () => {
    expect(describeFreshness("2hr", null)).toBeNull();
  });
});

describe("ForecastTimestamp", () => {
  it("renders nothing for a reading that is not one", () => {
    const { container } = render(
      <ForecastTimestamp weather={{ ...forecast, source: "error" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("puts the clock icon in place of the word 'Updated'", () => {
    render(<ForecastTimestamp weather={forecast} />);

    expect(screen.getByTestId("icon-schedule")).toBeInTheDocument();
    expect(screen.getByText("4m ago")).toBeInTheDocument();
  });

  it("spells out the tiers the clock cannot stand in for", () => {
    render(<ForecastTimestamp weather={{ ...forecast, source: "4day" }} />);

    // Twice: once visibly, once for a screen reader. The clock glyph stands in
    // for the word "Updated" and for nothing else, so "Outlook" has to be
    // written out rather than reduced to a bare age.
    expect(screen.getAllByText("Outlook · 4m ago")).toHaveLength(2);
  });
});
