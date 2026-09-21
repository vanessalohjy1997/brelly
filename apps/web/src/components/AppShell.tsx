"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { MaxContentWidth } from "@/constants/theme";
import { guardNavigation } from "@/store/unsavedChangesStore";

import { Icon } from "./Icon";
import { Icons, type IconName } from "./icons";
import { Text } from "./Text";

/**
 * The tab bar's replacement, and it is a rewrite rather than a port:
 * `appTabs.tsx` is `expo-router/unstable-native-tabs`, a UIKit control with no
 * web equivalent at all.
 *
 * Two shapes from one list. At 768px and up the navigation is a sidebar, which
 * is what a desktop window's width is *for* — a bottom bar there wastes the
 * whole left third and puts the controls as far from the pointer as they can
 * be. Below that it is a bar along the bottom edge, one tap from a thumb.
 *
 * The bar is back after a round as a drawer (round 40), and the trade is worth
 * stating because it was made knowingly both times. The drawer gave the whole
 * bottom edge to the browser's own chrome; what it cost was the app's core
 * movement — Today to Plans and back — becoming two taps, the first at the
 * top-left corner, the furthest point on the screen from a right thumb. Four
 * destinations is exactly the case a bottom bar is for, and
 * `env(safe-area-inset-bottom)` is how the bar and the browser's chrome share
 * the edge rather than fight over it.
 *
 * Both shapes are in the markup, and exactly one is ever reachable: the sidebar
 * is `display: none` below `md` and the bar is `display: none` above it. That
 * matters beyond looks — `display: none` removes a subtree from the
 * accessibility tree and from the tab order, so the two `aria-label="Main"`
 * landmarks are never both live. They share one `DESTINATIONS` list, so a
 * route added to the app cannot reach one and miss the other.
 */
const DESTINATIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: Icons.today },
  { href: "/plans", label: "Plans", icon: Icons.plans },
  { href: "/history", label: "History", icon: Icons.history },
  { href: "/settings", label: "Settings", icon: Icons.settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SideNav />
      <main
        id="main"
        // Clears the bottom bar on a phone: the bar's own height, the safe
        // area beneath it, and room to scroll the last card clear of both.
        className="mx-auto w-full flex-1 px-three pb-[calc(var(--brelly-hit-target)+var(--brelly-space-six)+env(safe-area-inset-bottom))] md:pb-five"
        style={{ maxWidth: MaxContentWidth }}
      >
        {children}
      </main>
      <BottomBar />
    </div>
  );
}

/**
 * Active state is computed from the pathname rather than held in state, so a
 * link opened in a new tab or pasted into the address bar lands with the right
 * item marked — which is the whole reason these are real URLs.
 */
function useIsActive(): (href: string) => boolean {
  const pathname = usePathname();
  return (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * One destination, in either shape. The navigation is the exit a modal never
 * had: `onNavigate` is the only hook that can ask *before* the navigation
 * happens — see `useUnsavedChangesGuard` for the two exits that cannot.
 */
function NavLink({
  destination,
  layout,
}: {
  destination: (typeof DESTINATIONS)[number];
  layout: "side" | "bar";
}) {
  const isActive = useIsActive();
  const router = useRouter();
  const active = isActive(destination.href);

  return (
    <Link
      href={destination.href}
      onNavigate={(event) =>
        guardNavigation(event, () => router.push(destination.href))
      }
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[var(--brelly-hit-target)] items-center rounded-control ${
        layout === "side"
          ? "gap-two px-two"
          : "flex-col justify-center gap-half px-one"
      } ${active ? "text-primary" : "text-text-secondary"} ${
        active && layout === "side" ? "bg-background-selected" : ""
      }`}
    >
      <Icon name={destination.icon} size="control" />
      <Text variant={layout === "side" ? "smallBold" : "eyebrow"} color="inherit">
        {destination.label}
      </Text>
    </Link>
  );
}

function SideNav() {
  return (
    <nav
      aria-label="Main"
      className="hidden shrink-0 border-r border-border px-two py-four md:block md:w-[12rem]"
    >
      <Text variant="title" as="p" className="px-two pb-four">
        Brelly
      </Text>
      <ul className="flex flex-col gap-one">
        {DESTINATIONS.map((destination) => (
          <li key={destination.href}>
            <NavLink destination={destination} layout="side" />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The narrow layout's navigation: four cells along the bottom edge.
 *
 * Fixed rather than sticky, because the page scrolls underneath it and the bar
 * has to stay put. `pb-[env(safe-area-inset-bottom)]` is what keeps it above
 * the home indicator on a phone that has one and costs nothing on one that
 * does not. At `z-field` — above the page's own content, below the place-search
 * dropdown that `SlotForm` floats at `z-dropdown`, and below every toast and
 * dialog at `z-overlay`.
 */
function BottomBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[var(--brelly-z-field)] border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex px-one py-one">
        {DESTINATIONS.map((destination) => (
          <li key={destination.href} className="min-w-0 flex-1">
            <NavLink destination={destination} layout="bar" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
