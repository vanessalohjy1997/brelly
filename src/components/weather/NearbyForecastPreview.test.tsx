import { render } from "@testing-library/react-native";

import { NearbyForecastPreview } from "@/components/weather/NearbyForecastPreview";
import type { UpcomingPeriodForecast } from "@/services/weather";

// NEA's 24hr endpoint splits the day into these named periods; the shapes
// below mirror what `normalizeTwentyFourHour` produces from it.
const midday: UpcomingPeriodForecast = {
  start: "2026-07-31T12:00:00+08:00",
  end: "2026-07-31T18:00:00+08:00",
  forecast: "Thundery Showers",
  temperature: { low: 26, high: 33 },
  humidity: { low: 60, high: 95 },
};
const evening: UpcomingPeriodForecast = {
  start: "2026-07-31T18:00:00+08:00",
  end: "2026-07-31T22:00:00+08:00",
  forecast: "Partly Cloudy (Night)",
  temperature: { low: 26, high: 33 },
  humidity: { low: 60, high: 95 },
};
const night: UpcomingPeriodForecast = {
  start: "2026-07-31T22:00:00+08:00",
  end: "2026-08-01T06:00:00+08:00",
  forecast: "Light Showers",
  temperature: { low: 26, high: 33 },
  humidity: { low: 60, high: 95 },
};

describe("NearbyForecastPreview", () => {
  it("renders nothing when there is no forecast to show", async () => {
    const view = await render(<NearbyForecastPreview forecasts={[]} />);

    expect(view.queryByText("Nearby")).toBeNull();
  });

  it("leads with an umbrella and raindrops when the next period is wet", async () => {
    const view = await render(
      <NearbyForecastPreview forecasts={[midday]} uvIndex={3} />,
    );

    expect(view.getByLabelText("Umbrella — rain")).toBeTruthy();
    expect(view.getAllByTestId("symbol-water_drop").length).toBeGreaterThan(1);
    expect(view.getByText("Thundery Showers")).toBeTruthy();
  });

  it("leads with an umbrella and a sun when it's dry but UV is high", async () => {
    const view = await render(
      <NearbyForecastPreview forecasts={[evening]} uvIndex={9} />,
    );

    expect(view.getByLabelText("Umbrella — sun")).toBeTruthy();
    expect(view.getByTestId("symbol-sunny")).toBeTruthy();
  });

  it("shows a plain sky icon and no umbrella when nothing is needed", async () => {
    const view = await render(
      <NearbyForecastPreview forecasts={[evening]} uvIndex={4} />,
    );

    expect(view.queryByTestId("symbol-umbrella")).toBeNull();
    expect(view.getByTestId("symbol-partly_cloudy_night")).toBeTruthy();
  });

  it("marks a later wet period, but never claims sun for one", async () => {
    const view = await render(
      // UV 10 applies to the hero only — a reading taken now says nothing
      // about tonight, so the later rows must not sprout suns.
      <NearbyForecastPreview forecasts={[midday, night]} uvIndex={10} />,
    );

    // Two umbrellas, one of them under a sun — the drops are a scatter per
    // icon, so they're counted by which icon speaks, not by glyph.
    expect(view.getAllByLabelText(/^Umbrella/)).toHaveLength(2);
    expect(view.getAllByLabelText("Umbrella — rain")).toHaveLength(1);
    expect(view.getAllByTestId("symbol-sunny")).toHaveLength(1);
    expect(view.getAllByTestId("symbol-umbrella")).toHaveLength(2);
  });

  it("works with no UV reading at all, falling back to rain alone", async () => {
    const view = await render(<NearbyForecastPreview forecasts={[midday]} />);

    expect(view.getByLabelText("Umbrella — rain")).toBeTruthy();
  });
});
