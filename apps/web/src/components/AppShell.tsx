"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { MaxContentWidth } from "@/constants/theme";
import { guardNavigation } from "@/store/unsavedChangesStore";

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
 * be. Below that it is a drawer behind a hamburger, opened from a slim bar at
 * the top.
 *
 * The drawer replaced a bottom tab bar, and the thing it gives up is real: a
 * bar at the bottom is one thumb-reachable tap away and a drawer is two, the
 * first of them at the top-left corner, which is the furthest point on the
 * screen from a right thumb. What it buys is the whole bottom edge back — the
 * browser's own chrome lives there on a phone, and a fixed bar above it spent a
 * permanent strip of a screen that is already the smallest one the app runs on.
 *
 * Round 42 put the bar back on the strength of the tap count, and it was
 * reversed the same day: the bottom tabs are the *phone app's* shape, and the
 * product decision is that the mobile web does not imitate it. Do not reopen
 * this on ergonomics alone — see round 42 in `NOTES.md`.
 *
 * Both shapes are in the markup, and exactly one is ever reachable: the sidebar
 * is `display: none` below `md`, and the drawer is a closed `<dialog>`, which is
 * `display: none` too. That matters beyond looks — `display: none` removes a
 * subtree from the accessibility tree and from the tab order, so the two
 * `aria-label="Main"` landmarks are never both live. They share one
 * `DESTINATIONS` list, so a route added to the app cannot reach one and miss
 * the other.
 */
const DESTINATIONS = [
  { href: "/", label: "Today", icon: Icons.today },
  { href: "/plans", label: "Plans", icon: Icons.plans },
  { href: "/history", label: "History", icon: Icons.history },
  { href: "/settings", label: "Settings", icon: Icons.settings },
] as const;

/** Tailwind's `md`, the width at which the sidebar takes over from the drawer. */
const WIDE_LAYOUT = "(min-width: 48rem)";

/** The drawer's `aria-controls` target, so the hamburger can name what it opens. */
const MENU_ID = "main-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // The drawer belongs to the narrow layout. Above `md` the sidebar is back and
  // a modal over it is a focus trap with nothing left to offer, so a rotation
  // or a dragged window edge that crosses the breakpoint closes it. Nothing
  // else can: the hamburger is gone at that width, so there is no way back out
  // by hand except Escape.
  useEffect(() => {
    const wide = window.matchMedia(WIDE_LAYOUT);
    const closeIfWide = () => {
      if (wide.matches) setMenuOpen(false);
    };
    wide.addEventListener("change", closeIfWide);
    return () => wide.removeEventListener("change", closeIfWide);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SideNav />
      <MenuBar open={menuOpen} onOpen={() => setMenuOpen(true)} />
      <main
        id="main"
        className="mx-auto w-full flex-1 px-three pb-five"
        style={{ maxWidth: MaxContentWidth }}
      >
        {children}
      </main>
      <MenuDrawer open={menuOpen} onClose={closeMenu} />
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
 * The wordmark and the four destinations — the whole of the navigation, in the
 * one copy the sidebar and the drawer both render.
 */
function NavList({ onNavigated }: { onNavigated?: () => void }) {
  const isActive = useIsActive();
  const router = useRouter();

  return (
    <>
      <Text variant="title" as="p" className="px-two pb-four">
        Brelly
      </Text>
      <ul className="flex flex-col gap-one">
        {DESTINATIONS.map((destination) => (
          <li key={destination.href}>
            <Link
              href={destination.href}
              // The navigation is the exit a modal never had. `onNavigate` is
              // the only hook that can ask *before* the navigation happens —
              // see `useUnsavedChangesGuard` for the two exits that cannot.
              //
              // The drawer closes either way, including when the guard stops
              // the navigation: the question it raises is itself a modal
              // `<dialog>`, and stacking one over another leaves the answer
              // behind a scrim nobody asked for.
              onNavigate={(event) => {
                guardNavigation(event, () => router.push(destination.href));
                onNavigated?.();
              }}
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
    </>
  );
}

function SideNav() {
  return (
    <nav
      aria-label="Main"
      className="hidden shrink-0 border-r border-border px-two py-four md:block md:w-[12rem]"
    >
      <NavList />
    </nav>
  );
}

/**
 * The narrow layout's top bar: the hamburger and nothing else.
 *
 * No wordmark beside it on purpose. Every page opens with its own `<h1>`
 * directly below, and a second piece of chrome above that one is the app's name
 * repeated at the top of a screen whose scarce dimension is height.
 *
 * Sticky rather than fixed, so it costs the page no padding to clear it, and at
 * `z-field` — above the page's own content, below the place-search dropdown
 * that `SlotForm` floats at `z-dropdown`, which is the right way round.
 */
function MenuBar({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <div className="sticky top-0 z-[var(--brelly-z-field)] border-b border-border bg-background px-two py-one md:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        className="flex min-h-[var(--brelly-hit-target)] min-w-[var(--brelly-hit-target)] items-center justify-center rounded-control text-text"
      >
        <Icon name={Icons.menu} size="controlEmphasis" />
      </button>
    </div>
  );
}

/**
 * The navigation as a left-hand sheet.
 *
 * A native `<dialog>` opened with `showModal()`, for the same reason
 * `DialogHost` is one: it brings the focus trap, the Escape key, the inert
 * background and the top layer with it, and a hand-rolled drawer is where every
 * one of those is reimplemented badly. What is styled away is only its
 * position — Tailwind's preflight has already zeroed the centring margin, so
 * the sheet sits against the left edge at full height.
 *
 * A click on the backdrop reports the `<dialog>` itself as its target, which is
 * what makes tap-outside-to-close two lines rather than an overlay element. The
 * panel fills the dialog, so no click *inside* it can be mistaken for one.
 */
function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      id={MENU_ID}
      ref={ref}
      // Escape fires `cancel`, and letting it close the element directly would
      // leave `menuOpen` true — the state and the element would then disagree
      // about whether the drawer is open, and the next press of the hamburger
      // would do nothing.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-[12rem] border-r border-border bg-background backdrop:bg-[rgb(0_0_0/0.4)]"
    >
      <nav aria-label="Main" className="flex h-full flex-col px-two pt-two pb-four">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="mb-two flex min-h-[var(--brelly-hit-target)] min-w-[var(--brelly-hit-target)] items-center justify-center self-end rounded-control text-text-secondary"
        >
          <Icon name={Icons.close} size="controlEmphasis" />
        </button>
        <NavList onNavigated={onClose} />
      </nav>
    </dialog>
  );
}
