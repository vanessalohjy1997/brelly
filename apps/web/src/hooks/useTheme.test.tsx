import { act, renderHook } from "@testing-library/react";

import { Colors } from "@/constants/theme";
import { useSettingsStore } from "@brelly/core";

import { useAppColorScheme, useSystemColorScheme, useTheme } from "./useTheme";

type Listener = () => void;

let prefersDark = false;
const listeners = new Set<Listener>();

beforeAll(() => {
  // jsdom ships no `matchMedia`. This stands in for one whose answer can be
  // changed, which is the behaviour under test: a system theme switched while
  // the page is open has to reach the app without a reload.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("dark") && prefersDark,
      media: query,
      addEventListener: (_: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) =>
        listeners.delete(listener),
    }),
  });
});

beforeEach(() => {
  prefersDark = false;
  listeners.clear();
  useSettingsStore.setState({ themePreference: "system" });
});

function setSystemDark(dark: boolean) {
  prefersDark = dark;
  act(() => listeners.forEach((listener) => listener()));
}

describe("useSystemColorScheme", () => {
  it("reads the media query", () => {
    prefersDark = true;
    expect(renderHook(() => useSystemColorScheme()).result.current).toBe("dark");
  });

  it("follows a change made while the page is open", () => {
    const { result } = renderHook(() => useSystemColorScheme());
    expect(result.current).toBe("light");

    setSystemDark(true);

    expect(result.current).toBe("dark");
  });
});

describe("useAppColorScheme", () => {
  it("follows the system when the preference says to", () => {
    const { result } = renderHook(() => useAppColorScheme());
    expect(result.current).toBe("light");

    setSystemDark(true);
    expect(result.current).toBe("dark");
  });

  it("lets an explicit preference override the system", () => {
    prefersDark = true;
    useSettingsStore.setState({ themePreference: "light" });

    expect(renderHook(() => useAppColorScheme()).result.current).toBe("light");
  });
});

describe("useTheme", () => {
  it("hands back the palette for the effective scheme", () => {
    useSettingsStore.setState({ themePreference: "dark" });
    expect(renderHook(() => useTheme()).result.current).toBe(Colors.dark);
  });
});
