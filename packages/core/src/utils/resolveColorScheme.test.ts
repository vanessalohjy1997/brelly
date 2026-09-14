import { resolveColorScheme } from "@/utils/resolveColorScheme";

describe("resolveColorScheme", () => {
  it("follows the system scheme when preference is 'system'", () => {
    expect(resolveColorScheme("system", "dark")).toBe("dark");
    expect(resolveColorScheme("system", "light")).toBe("light");
  });

  it("overrides the system scheme when preference is explicit", () => {
    expect(resolveColorScheme("dark", "light")).toBe("dark");
    expect(resolveColorScheme("light", "dark")).toBe("light");
  });

  it("falls back to light when the system scheme is unavailable", () => {
    expect(resolveColorScheme("system", "unspecified")).toBe("light");
    expect(resolveColorScheme("system", null)).toBe("light");
    expect(resolveColorScheme("system", undefined)).toBe("light");
  });
});
