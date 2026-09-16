/* eslint-disable @typescript-eslint/no-explicit-any --
   The stand-in forwards whatever props `Link` was given, and typing that
   exactly would be typing `next/link` a second time. */
import type { ReactNode } from "react";

/**
 * `next/link` outside a Next router.
 *
 * It renders an `<a>` in production too, so a plain anchor is a faithful
 * stand-in for everything these tests ask — that the href is right, that the
 * accessible name is there. What it is not faithful to is client-side
 * navigation, which is the router's job and not a page's.
 *
 * `onNavigate` is the exception, and it is honoured rather than forwarded: it
 * is the hook that fires *before* a navigation the router would handle, which
 * is where this app's unsaved-changes guard lives and where the drawer closes
 * itself. A stand-in that passed it to the `<a>` would leave both untestable.
 * The default is then prevented, because the real `Link` does not let the
 * document navigate either — and jsdom answers one that does with a page of
 * "Not implemented" noise.
 */
export function mockNextLink() {
  const Link = ({
    href,
    children,
    onNavigate,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  } & Record<string, any>) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        onNavigate?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  );
  Link.displayName = "Link";
  return { __esModule: true, default: Link };
}
