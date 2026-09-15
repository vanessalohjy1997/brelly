import RootLayout, { metadata, viewport } from "./layout";

const cookieValue = jest.fn<string | undefined, [string]>(() => undefined);

jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValue(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

/**
 * Called rather than rendered. This is a server component whose whole output is
 * the document shell, and mounting `<html>` inside jsdom's container would
 * assert on React's nesting warnings rather than on the shell. It is also
 * `async`, which `render` has no way to await.
 */
async function shell() {
  return RootLayout({ children: <p>content</p> });
}

beforeEach(() => {
  cookieValue.mockReturnValue(undefined);
});

describe("RootLayout", () => {
  it("is the document shell, with the language declared", async () => {
    const tree = await shell();

    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("en");
  });

  it("leaves data-theme off when the preference is to follow the system", async () => {
    // The attribute has to *lose* a specificity contest with
    // `prefers-color-scheme`, and the only reliable way to lose one is not to
    // enter it. `undefined` here is what React renders as no attribute at all.
    cookieValue.mockReturnValue("system");
    expect((await shell()).props["data-theme"]).toBeUndefined();
  });

  it("leaves it off when there is no cookie yet", async () => {
    expect((await shell()).props["data-theme"]).toBeUndefined();
  });

  it("stamps an explicit choice so a returning visit does not flash", async () => {
    cookieValue.mockReturnValue("dark");
    expect((await shell()).props["data-theme"]).toBe("dark");

    cookieValue.mockReturnValue("light");
    expect((await shell()).props["data-theme"]).toBe("light");
  });

  it("ignores a cookie value that is not a preference", async () => {
    // Cookie text is attacker-controlled like any other input, and this one is
    // interpolated straight into an attribute.
    cookieValue.mockReturnValue('dark" onload="alert(1)');
    expect((await shell()).props["data-theme"]).toBeUndefined();
  });

  it("names the app and says what it is for", () => {
    expect(metadata.title).toBe("Brelly");
    expect(metadata.description).toMatch(/weather/i);
  });

  it("scales to the device rather than to a fixed desktop width", () => {
    expect(viewport).toMatchObject({ width: "device-width", initialScale: 1 });
  });
});
