import { cleanup, render, screen } from "@testing-library/react";

import { umbrellaMarks, UmbrellaVerdictIcon } from "./UmbrellaVerdictIcon";
import {
  HANDLE_STROKE,
  HANDLE_STROKE_COMPACT,
  MARK_VIEW_BOX,
} from "./umbrellaMark";

/** The drawn canopy, which has no text to find it by. */
function umbrellaSvg() {
  return document.querySelector<SVGSVGElement>(
    `svg[viewBox="${MARK_VIEW_BOX}"]`,
  );
}

describe("umbrellaMarks", () => {
  it("carries both marks when a stop trips both triggers", () => {
    // More honest than picking a winner the way the single tint has to.
    expect(umbrellaMarks("both")).toEqual(["rain", "sun"]);
  });

  it("carries one for one", () => {
    expect(umbrellaMarks("rain")).toEqual(["rain"]);
    expect(umbrellaMarks("sun")).toEqual(["sun"]);
  });

  it("carries none for a clear stop", () => {
    expect(umbrellaMarks("none")).toEqual([]);
  });
});

describe("UmbrellaVerdictIcon", () => {
  it("renders nothing at all for a clear stop", () => {
    // A clear stop earns no umbrella — the same restraint the card applies to
    // the accent bar and the watermark.
    const { container } = render(
      <UmbrellaVerdictIcon reason="none" colorClass="text-text" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("draws the umbrella with rain drops around it", () => {
    render(<UmbrellaVerdictIcon reason="rain" colorClass="text-umbrella-rain" />);

    expect(screen.getByTestId("umbrella-verdict-rain")).toBeInTheDocument();
    // Five drops at `lead`, which is above the compact threshold.
    expect(screen.getAllByText("water_drop")).toHaveLength(5);
    // The canopy is drawn, not set: Material's `umbrella` ligature is a furled
    // umbrella, which read as rain around a closed stick.
    expect(umbrellaSvg()).not.toBeNull();
    expect(screen.queryByText("umbrella")).not.toBeInTheDocument();
  });

  it("uses fewer, bigger drops where the frame has no room", () => {
    // The full scatter at 22px puts 3px drops on screen, which is dust rather
    // than rain.
    render(
      <UmbrellaVerdictIcon
        reason="rain"
        size="controlEmphasis"
        colorClass="text-umbrella-rain"
      />,
    );
    expect(screen.getAllByText("water_drop")).toHaveLength(3);
  });

  it("gives the sun the top-right and thins the rain when both are shown", () => {
    render(<UmbrellaVerdictIcon reason="both" colorClass="text-umbrella-rain" />);

    expect(screen.getAllByText("water_drop")).toHaveLength(3);
    expect(screen.getByText("sunny")).toBeInTheDocument();
  });

  it("is decorative unless it is the only thing saying the verdict", () => {
    const { rerender } = render(
      <UmbrellaVerdictIcon reason="sun" colorClass="text-umbrella-sun" />,
    );
    expect(screen.getByTestId("umbrella-verdict-sun")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    rerender(
      <UmbrellaVerdictIcon
        reason="sun"
        colorClass="text-umbrella-sun"
        label="Umbrella — strong sun"
      />,
    );
    expect(
      screen.getByRole("img", { name: "Umbrella — strong sun" }),
    ).toBeInTheDocument();
  });

  it("scales every part from the frame, so one token sizes the whole icon", () => {
    render(
      <UmbrellaVerdictIcon reason="rain" size="hero" colorClass="text-text" />,
    );

    // The frame takes the token; the parts are fractions of it in `em`, which
    // is what keeps the composition's proportions at every size.
    expect(screen.getByTestId("umbrella-verdict-rain")).toHaveStyle({
      fontSize: "var(--brelly-icon-hero)",
    });
    expect(umbrellaSvg()).toHaveStyle({ height: "0.8em" });
  });

  it("thickens the handle where the frame is too small to render it", () => {
    // The canopy is a solid fill and survives any size; the shaft and hook are
    // strokes, and at `controlEmphasis` the mark is 19px tall, which puts the
    // icon file's 42 on about one device pixel.
    render(
      <UmbrellaVerdictIcon
        reason="rain"
        size="controlEmphasis"
        colorClass="text-umbrella-rain"
      />,
    );
    expect(
      umbrellaSvg()?.querySelector("path[stroke]"),
    ).toHaveAttribute("stroke-width", String(HANDLE_STROKE_COMPACT));

    cleanup();
    render(<UmbrellaVerdictIcon reason="rain" colorClass="text-umbrella-rain" />);
    expect(
      umbrellaSvg()?.querySelector("path[stroke]"),
    ).toHaveAttribute("stroke-width", String(HANDLE_STROKE));
  });
});
