import { act, render } from "@testing-library/react";

import { useSettingsStore } from "@brelly/core";

import { ThemeSync } from "./ThemeSync";

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  document.cookie = "brelly-theme=; Max-Age=0; Path=/";
  useSettingsStore.setState({ themePreference: "system" });
});

describe("ThemeSync", () => {
  it("renders nothing", () => {
    const { container } = render(<ThemeSync />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stamps an explicit preference on the document", () => {
    useSettingsStore.setState({ themePreference: "dark" });
    render(<ThemeSync />);

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("removes the attribute for 'system' rather than setting it", () => {
    // Setting `data-theme="system"` would match `:root[data-theme]` selectors
    // and quietly win against `prefers-color-scheme`, which is exactly what
    // following the system means not doing.
    document.documentElement.dataset.theme = "dark";
    render(<ThemeSync />);

    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("mirrors the preference to a cookie for the next visit's first paint", () => {
    useSettingsStore.setState({ themePreference: "light" });
    render(<ThemeSync />);

    expect(document.cookie).toContain("brelly-theme=light");
  });

  it("follows a change that arrives from Firestore", () => {
    // Which is how this value actually moves: the settings listener delivers
    // it, often after the first paint, and on a phone-side change it arrives
    // with no user action in this tab at all.
    render(<ThemeSync />);
    expect(document.documentElement.dataset.theme).toBeUndefined();

    act(() => useSettingsStore.setState({ themePreference: "dark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
