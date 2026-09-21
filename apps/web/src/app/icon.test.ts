import fs from "node:fs";
import path from "node:path";

/**
 * The tab icon is a file, not code — Next turns `app/icon.svg` and
 * `app/apple-icon.png` into `<link rel="icon">` tags by their names alone. So
 * what is worth asserting is not that a component renders, but that the two
 * ways the file convention can silently stop working have not happened:
 * the file is gone (and the tab falls back to the browser's globe, with
 * nothing failing), or the mark inside it has drifted from the phone's.
 */
const APP_DIR = __dirname;
const PHONE_ICON = path.join(
  APP_DIR,
  "../../../mobile/assets/icon/light-hook.svg",
);

/** The canopy outline — the part of the mark anyone actually recognises. */
function canopyPath(svg: string) {
  return /<path d="(M 196,540[^"]*)"/.exec(svg)?.[1];
}

describe("the tab icon", () => {
  const svg = fs.readFileSync(path.join(APP_DIR, "icon.svg"), "utf8");

  it("is where Next's file convention looks for it", () => {
    // Named, not globbed: a rename to `favicon.svg` or `logo.svg` produces no
    // error anywhere, just a browser-default icon on every page.
    expect(fs.existsSync(path.join(APP_DIR, "icon.svg"))).toBe(true);
    expect(fs.existsSync(path.join(APP_DIR, "apple-icon.png"))).toBe(true);
  });

  it("draws the same umbrella as the phone's app icon", () => {
    const phone = fs.readFileSync(PHONE_ICON, "utf8");

    expect(canopyPath(svg)).toBeDefined();
    expect(canopyPath(svg)).toBe(canopyPath(phone));
  });

  it("uses the brand ink and the light tile, not a recoloured copy", () => {
    expect(svg).toContain("#4A3D7C");
    expect(svg).toContain("#F6F2FD");
    expect(svg).toContain("#E3DAF4");
  });

  it("scales the mark up for 16px, which is the point of a separate file", () => {
    // If this ever equals the phone's framing, the re-cut has been reverted
    // and the icon is 18% padding again.
    expect(svg).toContain("scale(1.23)");
    expect(svg).toMatch(/viewBox="0 0 1024 1024"/);
  });
});
