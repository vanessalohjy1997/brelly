import RootLayout, { metadata, viewport } from "./layout";

/**
 * Called rather than rendered. This is a server component whose whole output is
 * the document shell, and mounting `<html>` inside jsdom's container div would
 * assert on React's nesting warnings rather than on the shell.
 */
describe("RootLayout", () => {
  it("is the document shell, with the language declared", () => {
    const tree = RootLayout({ children: <p>content</p> });

    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("en");
  });

  it("names the app and says what it is for", () => {
    expect(metadata.title).toBe("Brelly");
    expect(metadata.description).toMatch(/weather/i);
  });

  it("scales to the device rather than to a fixed desktop width", () => {
    expect(viewport).toMatchObject({ width: "device-width", initialScale: 1 });
  });
});
