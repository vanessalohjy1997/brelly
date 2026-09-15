import { render, screen, within } from "@testing-library/react";

import { AppShell } from "./AppShell";

const pathname = jest.fn(() => "/");
const push = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  pathname.mockReturnValue("/");
});

function navs() {
  return screen.getAllByRole("navigation", { name: "Main" });
}

describe("AppShell", () => {
  it("offers the same four destinations in both bars", () => {
    // One `DESTINATIONS` list renders both, so a route added to the app cannot
    // reach the sidebar and miss the bottom bar.
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );

    for (const bar of navs()) {
      expect(
        within(bar)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      ).toEqual(["/", "/plans", "/history", "/settings"]);
    }
  });

  it("marks the current page, from the URL rather than from state", () => {
    // Which is the whole reason these are real routes: a link pasted into the
    // address bar lands with the right item marked.
    pathname.mockReturnValue("/plans");
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );

    for (const bar of navs()) {
      const current = within(bar).getAllByRole("link", { current: "page" });
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveAttribute("href", "/plans");
    }
  });

  it("does not mark Today on every page just because its href is /", () => {
    pathname.mockReturnValue("/history");
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );

    const today = within(navs()[0]).getByRole("link", { name: /today/i });
    expect(today).not.toHaveAttribute("aria-current");
  });

  it("marks Today on a nested route beneath a section", () => {
    pathname.mockReturnValue("/plans/abc");
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );

    expect(
      within(navs()[0]).getByRole("link", { name: /plans/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("gives the page a landmark the skip link can reach", () => {
    render(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );

    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByText("page")).toBeInTheDocument();
  });
});
