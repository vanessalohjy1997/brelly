import fs from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";

import {
  CANOPY_PATH,
  HANDLE_PATH,
  MARK_ASPECT,
  MARK_VIEW_BOX,
  UmbrellaMark,
} from "./umbrellaMark";

/**
 * The app icon, which is the one drawing of the Brelly umbrella there is: the
 * phone's launcher icon, the browser tab (`app/icon.svg`) and now the verdict
 * watermark all come from this file. Copies are what let them drift, so the
 * copy is compared rather than trusted.
 */
const ICON_FILE = path.join(
  __dirname,
  "../../../../mobile/assets/icon/light-hook.svg",
);

describe("the umbrella mark", () => {
  const icon = fs.readFileSync(ICON_FILE, "utf8");

  it("is the same canopy and handle the app icon draws", () => {
    expect(icon).toContain(`d="${CANOPY_PATH}"`);
    expect(icon).toContain(`d="${HANDLE_PATH}"`);
  });

  it("frames the mark tightly, because the caller supplies the padding", () => {
    // The hook hangs half a stroke below its own arc and the ferrule rises
    // above the canopy, so the box is not the icon's 0 0 1024 1024 canvas.
    expect(MARK_VIEW_BOX).toBe("196 196 632 699");
    expect(MARK_ASPECT).toBeCloseTo(0.904, 3);
  });

  it("takes the surrounding tint rather than the icon file's ink", () => {
    // `#4A3D7C` is right on a lavender launcher tile and wrong on a verdict
    // that is amber or blue.
    const { container } = render(<UmbrellaMark heightEm={0.8} />);
    const svg = container.querySelector("svg")!;

    expect(svg.innerHTML).not.toContain("#4A3D7C");
    for (const part of svg.querySelectorAll("path, rect")) {
      const painted =
        part.getAttribute("fill") ?? part.getAttribute("stroke");
      expect(painted).toBe("currentColor");
    }
  });

  it("sizes itself from the height it is given and stays centred", () => {
    const { container } = render(<UmbrellaMark heightEm={0.8} />);
    const svg = container.querySelector("svg")!;

    expect(svg).toHaveStyle({ height: "0.8em" });
    // Width follows the aspect, so the canopy is never squashed, and the left
    // offset centres whatever width that turns out to be.
    expect(svg.style.width).toBe(`${0.8 * MARK_ASPECT}em`);
    expect(svg.style.left).toBe(`${(1 - 0.8 * MARK_ASPECT) / 2}em`);
  });

  it("widens the ferrule with the handle so the two stay one shaft", () => {
    const { container } = render(<UmbrellaMark heightEm={0.8} strokeWidth={62} />);
    const rect = container.querySelector("rect")!;

    expect(rect).toHaveAttribute("width", "62");
    // Centred on the canvas midline, not left at the icon file's x=493.
    expect(rect).toHaveAttribute("x", "481");
    expect(rect).toHaveAttribute("rx", "31");
  });

  it("is decorative — the verdict frame around it carries any label", () => {
    const { container } = render(<UmbrellaMark heightEm={0.8} />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
