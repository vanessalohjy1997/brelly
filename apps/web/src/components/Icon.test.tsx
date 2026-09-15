import { render, screen } from "@testing-library/react";

import { Icon } from "./Icon";
import { Icons } from "./icons";

describe("Icon", () => {
  it("draws the ligature and hides it from assistive technology", () => {
    // The glyph's text content *is* the ligature, so an unhidden icon is
    // announced as "rainy" — which is why hidden is the default rather than
    // the exception.
    render(<Icon name={Icons.rain} />);

    const glyph = screen.getByTestId("icon-rainy");
    expect(glyph).toHaveTextContent("rainy");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("becomes a labelled image when the icon is the only thing saying it", () => {
    render(<Icon name={Icons.alertsOff} label="Rain alerts muted" />);

    expect(
      screen.getByRole("img", { name: "Rain alerts muted" }),
    ).toBeInTheDocument();
    // Still hidden underneath, so the label is announced once rather than
    // followed by "notifications_off".
    expect(screen.getByTestId("icon-notifications_off")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("sizes from the token, never from a number", () => {
    render(<Icon name={Icons.add} size="hero" />);
    expect(screen.getByTestId("icon-add")).toHaveStyle({
      fontSize: "var(--brelly-icon-hero)",
    });
  });

  it("kebab-cases a two-word size to match the emitted variable", () => {
    render(<Icon name={Icons.umbrella} size="controlEmphasis" />);
    expect(screen.getByTestId("icon-umbrella")).toHaveStyle({
      fontSize: "var(--brelly-icon-control-emphasis)",
    });
  });

  it("defaults to controlEmphasis", () => {
    render(<Icon name={Icons.search} />);
    expect(screen.getByTestId("icon-search")).toHaveStyle({
      fontSize: "var(--brelly-icon-control-emphasis)",
    });
  });
});
