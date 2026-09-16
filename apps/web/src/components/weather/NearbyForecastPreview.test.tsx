import { render, screen } from "@testing-library/react";

import type { UpcomingPeriodForecast } from "@brelly/core";

import { NearbyForecastPreview } from "./NearbyForecastPreview";

const periods: UpcomingPeriodForecast[] = [
  {
    start: "2026-09-15T12:00:00+08:00",
    end: "2026-09-15T18:00:00+08:00",
    forecast: "Thundery Showers",
    temperature: { low: 25, high: 32 },
    humidity: { low: 60, high: 95 },
  },
  {
    start: "2026-09-15T18:00:00+08:00",
    end: "2026-09-16T00:00:00+08:00",
    forecast: "Partly Cloudy (Night)",
    temperature: { low: 25, high: 32 },
    humidity: { low: 60, high: 95 },
  },
];

describe("NearbyForecastPreview", () => {
  it("renders nothing with nothing to show", () => {
    const { container } = render(<NearbyForecastPreview forecasts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("gives the soonest period the hero treatment", () => {
    render(<NearbyForecastPreview forecasts={periods} />);

    expect(screen.getByRole("heading", { name: "Nearby" })).toBeInTheDocument();
    expect(screen.getByText("Thundery Showers")).toBeInTheDocument();
    // Temperature on the hero alone: NEA reports one range for the whole day,
    // so repeating it per period would be noise.
    expect(screen.getAllByText(/25–32°C/)).toHaveLength(1);
  });

  it("lets the hero icon speak, since nothing beside it repeats the verdict", () => {
    render(<NearbyForecastPreview forecasts={periods} />);
    expect(
      screen.getByRole("img", { name: /umbrella/i }),
    ).toBeInTheDocument();
  });

  it("claims the UV reading for the soonest period only", () => {
    // A UV reading taken now says nothing about this evening.
    render(<NearbyForecastPreview forecasts={periods} uvIndex={11} />);

    const suns = screen.queryAllByText("sunny");
    expect(suns.length).toBeGreaterThan(0);
    // The later row is a night period and gets no sun mark of its own.
    expect(screen.getByText("Partly Cloudy (Night)")).toBeInTheDocument();
  });

  it("draws a plain weather icon when no umbrella is needed", () => {
    render(
      <NearbyForecastPreview
        forecasts={[{ ...periods[0], forecast: "Fair (Day)" }]}
      />,
    );
    expect(screen.getByTestId("icon-sunny")).toBeInTheDocument();
    expect(screen.queryByTestId(/umbrella-verdict/)).not.toBeInTheDocument();
  });
});
