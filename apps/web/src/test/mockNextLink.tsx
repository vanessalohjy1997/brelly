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
 */
export function mockNextLink() {
  const Link = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  } & Record<string, any>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  Link.displayName = "Link";
  return { __esModule: true, default: Link };
}
