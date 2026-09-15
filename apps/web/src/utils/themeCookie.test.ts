import {
  parseThemeCookie,
  serialiseThemeCookie,
  THEME_COOKIE,
  themeAttribute,
} from "./themeCookie";

describe("parseThemeCookie", () => {
  it.each(["light", "dark", "system"] as const)("accepts %s", (value) => {
    expect(parseThemeCookie(value)).toBe(value);
  });

  it("rejects anything else, because cookie text is input like any other", () => {
    // The value is interpolated straight into a `data-theme` attribute during
    // server rendering.
    expect(parseThemeCookie('dark" onload="alert(1)')).toBeUndefined();
    expect(parseThemeCookie("")).toBeUndefined();
    expect(parseThemeCookie(undefined)).toBeUndefined();
  });
});

describe("themeAttribute", () => {
  it("maps an explicit choice to the attribute that overrides the media query", () => {
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("light")).toBe("light");
  });

  it("maps 'system' to no attribute at all", () => {
    // `:root[data-theme]` has to lose to `prefers-color-scheme` when the
    // preference is to follow the system, and the only reliable way to lose a
    // specificity contest is not to enter it.
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute(undefined)).toBeUndefined();
  });
});

describe("serialiseThemeCookie", () => {
  it("writes 'system' like any other value rather than clearing the cookie", () => {
    // Clearing would be indistinguishable from "no cookie yet", and those two
    // want different first paints on a machine whose system theme disagrees
    // with a deliberate choice to follow it.
    expect(serialiseThemeCookie("system")).toContain(`${THEME_COOKIE}=system`);
  });

  it("is site-wide, long-lived, and not sent cross-site", () => {
    const cookie = serialiseThemeCookie("dark");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
  });
});
