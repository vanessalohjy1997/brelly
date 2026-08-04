import { render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { VerdictPill } from "@/components/weather/VerdictPill";
import { Colors } from "@/constants/theme";
import { describeUmbrella } from "@/utils/describeUmbrella";

// Jest renders under the light scheme, so the expected values come from
// `Colors.light` rather than being hardcoded hex in two places.
const fillOf = (element: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(element.props.style as ViewStyle) ?? {}).backgroundColor;

const outlineOf = (element: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(element.props.style as ViewStyle) ?? {}).borderColor;

// Built from the real verdict rather than hand-written objects, so a change to
// the wording can't leave the pill asserting a string nothing produces.
const RAIN = describeUmbrella("Thundery Showers", 3);
const SUN = describeUmbrella("Fair (Day)", 9);
const BOTH = describeUmbrella("Passing Showers", 10);
const CLEAR = describeUmbrella("Partly Cloudy (Day)", 4);

describe("VerdictPill", () => {
  it("says the verdict at pill length, not as a sentence", async () => {
    const view = await render(<VerdictPill verdict={RAIN} />);

    expect(view.getByText("Rain")).toBeTruthy();
    expect(view.queryByText("Umbrella — rain")).toBeNull();
  });

  it("names the sun trigger", async () => {
    const view = await render(<VerdictPill verdict={SUN} />);

    expect(view.getByText("Sun")).toBeTruthy();
  });

  it("keeps both triggers when both fire", async () => {
    const view = await render(<VerdictPill verdict={BOTH} />);

    expect(view.getByText("Rain + sun")).toBeTruthy();
  });

  it("still shows a pill for a clear stop", async () => {
    const view = await render(<VerdictPill verdict={CLEAR} />);

    expect(view.getByText("Clear")).toBeTruthy();
  });

  it("gives a screen reader the whole sentence, not the short form", async () => {
    const view = await render(<VerdictPill verdict={BOTH} />);

    expect(view.getByLabelText("Umbrella — rain and sun")).toBeTruthy();
  });

  it("washes itself in the verdict's own colour", async () => {
    const wet = await render(<VerdictPill verdict={RAIN} />);
    const sunny = await render(<VerdictPill verdict={SUN} />);

    expect(fillOf(wet.getByLabelText(RAIN.label))).toBe(
      `${Colors.light.umbrellaRain}66`,
    );
    expect(fillOf(sunny.getByLabelText(SUN.label))).toBe(
      `${Colors.light.umbrellaSun}66`,
    );
  });

  // The washed fills are within 2:1 of each other — the umbrella colours are
  // luminance-matched on purpose — so the undiluted outline is what actually
  // distinguishes a rain pill from a sun one at this size.
  it("outlines itself in the same colour at full strength", async () => {
    const wet = await render(<VerdictPill verdict={RAIN} />);
    const sunny = await render(<VerdictPill verdict={SUN} />);

    expect(outlineOf(wet.getByLabelText(RAIN.label))).toBe(
      Colors.light.umbrellaRain,
    );
    expect(outlineOf(sunny.getByLabelText(SUN.label))).toBe(
      Colors.light.umbrellaSun,
    );
  });

  it("leaves a clear stop on the neutral surface, not a third hue", async () => {
    const view = await render(<VerdictPill verdict={CLEAR} />);

    expect(fillOf(view.getByLabelText(CLEAR.label))).toBe(
      Colors.light.backgroundSelected,
    );
    // Neutral outline too — quieter than the two that want something from
    // you, rather than differently loud.
    expect(outlineOf(view.getByLabelText(CLEAR.label))).toBe(
      Colors.light.border,
    );
  });

  it("tints both triggers with rain, the one with a cost to ignoring it", async () => {
    const view = await render(<VerdictPill verdict={BOTH} />);

    expect(outlineOf(view.getByLabelText(BOTH.label))).toBe(
      Colors.light.umbrellaRain,
    );
  });
});
