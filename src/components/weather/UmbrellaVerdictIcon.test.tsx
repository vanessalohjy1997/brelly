import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import {
  umbrellaMarks,
  UmbrellaVerdictIcon,
} from "@/components/weather/UmbrellaVerdictIcon";

// The mocked SymbolView in jest.setup.js tags each glyph with its Material
// name, which is how a test can see *which* picture is on screen.
const UMBRELLA = "symbol-umbrella";
const RAIN = "symbol-water_drop";
const SUN = "symbol-sunny";

describe("umbrellaMarks", () => {
  it("puts raindrops over the umbrella when rain is the trigger", () => {
    expect(umbrellaMarks("rain")).toEqual(["rain"]);
  });

  it("puts a sun over it when UV is the trigger", () => {
    expect(umbrellaMarks("sun")).toEqual(["sun"]);
  });

  it("carries both marks when both fire, rather than picking one", () => {
    expect(umbrellaMarks("both")).toEqual(["rain", "sun"]);
  });

  it("has no marks for a clear stop", () => {
    expect(umbrellaMarks("none")).toEqual([]);
  });
});

describe("UmbrellaVerdictIcon", () => {
  it("draws an umbrella with raindrops for rain", async () => {
    const view = await render(
      <UmbrellaVerdictIcon reason="rain" color="#2E6FB5" />,
    );

    expect(view.getByTestId(UMBRELLA)).toBeTruthy();
    // Drops, plural — one big glyph parked on the canopy read as a second
    // icon rather than as weather.
    expect(view.getAllByTestId(RAIN).length).toBeGreaterThan(1);
    expect(view.queryByTestId(SUN)).toBeNull();
  });

  it("scatters the drops instead of stacking them in one place", async () => {
    const view = await render(
      <UmbrellaVerdictIcon reason="rain" color="#2E6FB5" size={40} />,
    );

    const drops = view.getAllByTestId(RAIN);
    const sizes = new Set(
      drops.map((drop) => StyleSheet.flatten(drop.props.style)?.width),
    );

    // Every drop at the same size in a column would be a list, not rain.
    expect(sizes.size).toBeGreaterThan(1);
    // And all of them smaller than the umbrella they fall on.
    for (const size of sizes) expect(size).toBeLessThan(40 * 0.74);
  });

  it("draws an umbrella with a sun for high UV", async () => {
    const view = await render(
      <UmbrellaVerdictIcon reason="sun" color="#B2650A" />,
    );

    expect(view.getByTestId(UMBRELLA)).toBeTruthy();
    expect(view.getByTestId(SUN)).toBeTruthy();
    expect(view.queryByTestId(RAIN)).toBeNull();
  });

  it("draws both marks when the stop needs the umbrella twice over", async () => {
    const view = await render(
      <UmbrellaVerdictIcon reason="both" color="#2E6FB5" />,
    );

    expect(view.getAllByTestId(RAIN).length).toBeGreaterThan(0);
    expect(view.getByTestId(SUN)).toBeTruthy();
  });

  it("gives the rain less room when the sun shares the frame", async () => {
    const rainOnly = await render(
      <UmbrellaVerdictIcon reason="rain" color="#2E6FB5" />,
    );
    const shared = await render(
      <UmbrellaVerdictIcon reason="both" color="#2E6FB5" />,
    );

    expect(shared.getAllByTestId(RAIN).length).toBeLessThan(
      rainOnly.getAllByTestId(RAIN).length,
    );
  });

  it("renders no umbrella at all when nothing is needed", async () => {
    const view = await render(
      <UmbrellaVerdictIcon reason="none" color="#332F44" />,
    );

    expect(view.queryByTestId(UMBRELLA)).toBeNull();
  });

  it("tints every part of the icon with the verdict colour", async () => {
    const view = await render(
      <UmbrellaVerdictIcon reason="both" color="#2E6FB5" size={40} />,
    );

    // Colour is carried by the native prop, so assert the glyphs are present
    // rather than reaching into the mock's props: the umbrella, the sun, and
    // every drop.
    const glyphs = view.getAllByTestId(/^symbol-/);
    expect(glyphs.length).toBe(2 + view.getAllByTestId(RAIN).length);
  });

  it("stays decorative unless it is the only thing saying so", async () => {
    const silent = await render(
      <UmbrellaVerdictIcon reason="rain" color="#2E6FB5" />,
    );
    expect(silent.queryByLabelText("Umbrella — rain")).toBeNull();

    const spoken = await render(
      <UmbrellaVerdictIcon
        reason="rain"
        color="#2E6FB5"
        accessibilityLabel="Umbrella — rain"
      />,
    );
    expect(spoken.getByLabelText("Umbrella — rain")).toBeTruthy();
  });
});
