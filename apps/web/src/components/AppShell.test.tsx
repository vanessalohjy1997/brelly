import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useUnsavedChangesStore } from "@/store/unsavedChangesStore";
import { useDialogStore } from "@/store/dialogStore";
import { mockNextLink } from "@/test/mockNextLink";

import { AppShell } from "./AppShell";

// The real `Link` fires `onNavigate` only for a navigation its router handles,
// and there is no router here. The stand-in fires it on the click, which is the
// behaviour this file is about.
jest.mock("next/link", () => mockNextLink());

const pathname = jest.fn(() => "/");
const push = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  pathname.mockReturnValue("/");
  push.mockClear();
  useUnsavedChangesStore.setState({ dirty: false });
  useDialogStore.setState({ dialog: null });
});

function shell() {
  render(
    <AppShell>
      <p>page</p>
    </AppShell>,
  );
}

/** The sidebar and the bottom bar, the two shapes of the same `DESTINATIONS` list. */
function navs() {
  return screen.getAllByRole("navigation", { name: "Main" });
}

function hrefsIn(nav: HTMLElement) {
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
}

describe("AppShell", () => {
  it("offers the same four destinations in the sidebar and the bottom bar", () => {
    // One `DESTINATIONS` list renders both, so a route added to the app cannot
    // reach the sidebar and miss the bar.
    shell();

    expect(navs()).toHaveLength(2);
    for (const nav of navs()) {
      expect(hrefsIn(nav)).toEqual(["/", "/plans", "/history", "/settings"]);
    }
  });

  it("keeps exactly one of the two shapes reachable at a time", () => {
    // `display: none` takes a subtree out of the accessibility tree, so the
    // two `Main` landmarks are never both live.
    shell();
    const [sidebar, bar] = navs();

    expect(sidebar).toHaveClass("hidden", "md:block");
    expect(bar).toHaveClass("md:hidden", "fixed", "bottom-0");
  });

  it("marks the current page, from the URL rather than from state", () => {
    // Which is the whole reason these are real routes: a link pasted into the
    // address bar lands with the right item marked.
    pathname.mockReturnValue("/plans");
    shell();

    for (const nav of navs()) {
      const current = within(nav).getAllByRole("link", { current: "page" });
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveAttribute("href", "/plans");
    }
  });

  it("does not mark Today on every page just because its href is /", () => {
    pathname.mockReturnValue("/history");
    shell();

    const today = within(navs()[0]).getByRole("link", { name: /today/i });
    expect(today).not.toHaveAttribute("aria-current");
  });

  it("marks the section a nested route sits beneath", () => {
    pathname.mockReturnValue("/plans/abc");
    shell();

    expect(
      within(navs()[0]).getByRole("link", { name: /plans/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("gives the page a landmark the skip link can reach", () => {
    shell();

    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByText("page")).toBeInTheDocument();
  });

  it("navigates straight through when nothing is unsaved", async () => {
    shell();

    await userEvent.click(within(navs()[1]).getByRole("link", { name: /plans/i }));

    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("lets the unsaved-changes guard ask before a destination is left", async () => {
    // `onNavigate` is the only hook that can ask *before* the navigation
    // happens; the Back button and a closed tab each need their own mechanism.
    useUnsavedChangesStore.setState({ dirty: true });
    shell();

    await userEvent.click(within(navs()[1]).getByRole("link", { name: /plans/i }));

    expect(useDialogStore.getState().dialog).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
