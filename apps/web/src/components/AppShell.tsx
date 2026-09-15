"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MaxContentWidth } from "@/constants/theme";

import { Icon } from "./Icon";
import { Icons } from "./icons";
import { Text } from "./Text";

/**
 * The tab bar's replacement, and it is a rewrite rather than a port:
 * `appTabs.tsx` is `expo-router/unstable-native-tabs`, a UIKit control with no
 * web equivalent at all.
 *
 * Two shapes from one list. At 768px and up the navigation is a sidebar, which
 * is what a desktop window's width is *for* — a bottom bar there wastes the
 * whole left third and puts the controls as far from the pointer as they can
 * be. Below that it is a bottom bar, where a thumb is.
 *
 * Both are in the markup, one `display: none` at any width — which is what
 * keeps the duplication honest: `display: none` removes a subtree from the
 * accessibility tree and the tab order, so exactly one navigation is ever
 * reachable. They share one `DESTINATIONS` list, so a route added to the app
 * cannot reach one bar and miss the other.
 */
const DESTINATIONS = [
  { href: "/", label: "Today", icon: Icons.today },
  { href: "/plans", label: "Plans", icon: Icons.plans },
  { href: "/history", label: "History", icon: Icons.history },
  { href: "/settings", label: "Settings", icon: Icons.settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SideNav />
      <main
        id="main"
        className="mx-auto w-full flex-1 px-three pb-[calc(var(--brelly-hit-target)+var(--brelly-space-five))] md:pb-five"
        style={{ maxWidth: MaxContentWidth }}
      >
        {children}
      </main>
      <BottomNav />
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

function SideNav() {
  const isActive = useIsActive();

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
            <Link
              href={destination.href}
              aria-current={isActive(destination.href) ? "page" : undefined}
              className={`flex min-h-[var(--brelly-hit-target)] items-center gap-two rounded-control px-two ${
                isActive(destination.href)
                  ? "bg-background-selected text-primary"
                  : "text-text-secondary"
              }`}
            >
              <Icon name={destination.icon} size="control" />
              <Text variant="smallBold" color="inherit">
                {destination.label}
              </Text>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BottomNav() {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Main"
      // Opaque, not translucent: a list scrolling under a see-through bar costs
      // the icons their contrast, which is the same fix `appTabs` makes on iOS
      // with `blurEffect="none"` and an explicit background.
      className="fixed inset-x-0 bottom-0 border-t border-border bg-background md:hidden"
    >
      <ul className="flex">
        {DESTINATIONS.map((destination) => (
          <li key={destination.href} className="flex-1">
            <Link
              href={destination.href}
              aria-current={isActive(destination.href) ? "page" : undefined}
              className={`flex min-h-[var(--brelly-hit-target)] flex-col items-center justify-center gap-half py-one ${
                isActive(destination.href) ? "text-primary" : "text-text-secondary"
              }`}
            >
              <Icon name={destination.icon} size="control" />
              <Text variant="eyebrow" color="inherit">
                {destination.label}
              </Text>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
