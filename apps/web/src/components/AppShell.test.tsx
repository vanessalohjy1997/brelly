import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

type Listener = () => void;

let wideLayout = false;
const layoutListeners = new Set<Listener>();

beforeAll(() => {
  // jsdom ships neither `matchMedia` nor `<dialog>`'s modal behaviour. Both are
  // stood in for, and what is under test is the wiring around them — that the
  // hamburger opens the element, that every way out of it agrees with React
  // about whether it is open, and that crossing the breakpoint closes it. Not
  // the browser's focus trap, which is the reason a native `<dialog>` is here.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      // A getter, not a snapshot: `AppShell` keeps the `MediaQueryList` it was
      // handed at mount and reads `matches` when the `change` event arrives.
      get matches() {
        return wideLayout;
      },
      media: query,
      addEventListener: (_: string, listener: Listener) =>
        layoutListeners.add(listener),
      removeEventListener: (_: string, listener: Listener) =>
        layoutListeners.delete(listener),
    }),
  });

  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

beforeEach(() => {
  pathname.mockReturnValue("/");
  wideLayout = false;
  layoutListeners.clear();
  push.mockClear();
  useUnsavedChangesStore.setState({ dirty: false });
  useDialogStore.setState({ dialog: null });
});

/** Drag the window across the `md` breakpoint, the only thing that can close the drawer on its own. */
function widenPastBreakpoint() {
  wideLayout = true;
  act(() => layoutListeners.forEach((listener) => listener()));
}

function shell() {
  render(
    <AppShell>
      <p>page</p>
    </AppShell>,
  );
}

function drawer(): HTMLDialogElement {
  return screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
}

async function openDrawer() {
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  return drawer();
}

/** The sidebar and the drawer, the two shapes of the same `DESTINATIONS` list. */
function navs() {
  return screen.getAllByRole("navigation", { name: "Main" });
}

function hrefsIn(nav: HTMLElement) {
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
}

describe("AppShell", () => {
  it("offers the same four destinations in the sidebar and the drawer", async () => {
    // One `DESTINATIONS` list renders both, so a route added to the app cannot
    // reach the sidebar and miss the drawer.
    shell();
    await openDrawer();

    expect(navs()).toHaveLength(2);
    for (const nav of navs()) {
      expect(hrefsIn(nav)).toEqual(["/", "/plans", "/history", "/settings"]);
    }
  });

  it("marks the current page, from the URL rather than from state", async () => {
    // Which is the whole reason these are real routes: a link pasted into the
    // address bar lands with the right item marked.
    pathname.mockReturnValue("/plans");
    shell();
    await openDrawer();

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

  it("opens the drawer from the hamburger and says so on the button", async () => {
    shell();
    const button = screen.getByRole("button", { name: "Menu" });

    expect(drawer().open).toBe(false);
    expect(button).toHaveAttribute("aria-expanded", "false");
    // The button names what it controls, which is how the relationship is
    // announced at all — the drawer is not its descendant.
    expect(button).toHaveAttribute("aria-controls", drawer().id);

    await userEvent.click(button);

    expect(drawer().open).toBe(true);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the drawer when a destination is chosen", async () => {
    shell();
    const panel = await openDrawer();

    await userEvent.click(within(panel).getByRole("link", { name: /plans/i }));

    expect(drawer().open).toBe(false);
  });

  it("navigates straight through when nothing is unsaved", async () => {
    shell();
    const panel = await openDrawer();

    await userEvent.click(within(panel).getByRole("link", { name: /plans/i }));

    expect(useDialogStore.getState().dialog).toBeNull();
  });

  it("lets the unsaved-changes guard ask before a destination is left", async () => {
    // `onNavigate` is the only hook that can ask *before* the navigation
    // happens; the Back button and a closed tab each need their own mechanism.
    useUnsavedChangesStore.setState({ dirty: true });
    shell();
    const panel = await openDrawer();

    await userEvent.click(within(panel).getByRole("link", { name: /plans/i }));

    expect(useDialogStore.getState().dialog).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("closes the drawer even when the unsaved-changes guard stops the navigation", async () => {
    // The guard raises its own modal `<dialog>`. Leaving the drawer open would
    // stack one scrim over another, with the question behind both.
    useUnsavedChangesStore.setState({ dirty: true });
    shell();
    const panel = await openDrawer();

    await userEvent.click(within(panel).getByRole("link", { name: /plans/i }));

    expect(drawer().open).toBe(false);
  });

  it("closes the drawer from its own close button", async () => {
    shell();
    const panel = await openDrawer();

    await userEvent.click(within(panel).getByRole("button", { name: "Close menu" }));

    expect(drawer().open).toBe(false);
  });

  it("closes the drawer on a tap outside it", async () => {
    // A click on the backdrop reports the `<dialog>` as its target; a click on
    // the panel reports something inside it.
    shell();
    const panel = await openDrawer();

    await userEvent.click(within(panel).getByText("Brelly"));
    expect(drawer().open).toBe(true);

    fireEvent.click(drawer());
    expect(drawer().open).toBe(false);
  });

  it("closes the drawer on Escape without the button losing track of it", async () => {
    // Escape fires `cancel`, and letting the element close itself would leave
    // React thinking the drawer is open — after which the hamburger does
    // nothing, because the state it toggles never changed.
    shell();
    await openDrawer();

    fireEvent(drawer(), new Event("cancel", { cancelable: true, bubbles: true }));

    expect(drawer().open).toBe(false);
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("closes the drawer when the window widens to where the sidebar lives", async () => {
    // The hamburger is gone above `md`, so nothing on screen could close it.
    shell();
    await openDrawer();

    widenPastBreakpoint();

    expect(drawer().open).toBe(false);
  });
});
