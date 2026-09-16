import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { AppShell } from "@/components/AppShell";
import { Bootstrap } from "@/components/Bootstrap";
import { DialogHost } from "@/components/DialogHost";
import { iconFontHref } from "@/components/icons";
import { Providers } from "@/components/Providers";
import { ThemeSync } from "@/components/ThemeSync";
import { ToastHost } from "@/components/ToastHost";
import { buildTokensCss } from "@/constants/tokensCss";
import {
  parseThemeCookie,
  THEME_COOKIE,
  themeAttribute,
} from "@/utils/themeCookie";

import "./globals.css";

export const metadata: Metadata = {
  title: "Brelly",
  description: "The weather for the day you actually planned.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * The document shell.
 *
 * Three things happen here that have no counterpart in `_layout.tsx`, all of
 * them consequences of there being a server:
 *
 * 1. **The design tokens are emitted as CSS**, from the same TypeScript the
 *    phone compiles. Inline in `<head>` rather than a generated file, so the
 *    TypeScript is the only copy of the palette there is — see
 *    `constants/tokensCss.ts` for why that trade was made.
 * 2. **`data-theme` is set from a cookie.** The preference itself lives in
 *    Firestore and cannot be known on a first visit, so the cookie is a cache
 *    that removes the correction flash for returning visitors and nothing more.
 *    `ThemeSync` writes it; `utils/themeCookie.ts` is honest about the three
 *    cases it does not fix.
 * 3. **The icon font is subsetted** to the registry in `components/icons.ts`.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const preference = parseThemeCookie(
    (await cookies()).get(THEME_COOKIE)?.value,
  );

  return (
    <html lang="en" data-theme={themeAttribute(preference)}>
      <head>
        {/* The icon font, not a text face: every icon in the app is a
            ligature from it, so a page without it shows glyph names in words.
            `next/font` would self-host it and cannot — its Google catalogue
            excludes the icon fonts, checked rather than assumed. Self-hosting
            a build-time subset belongs with the Phase 4 hosting work,
            alongside the CSP that would forbid this. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={iconFontHref()} />
        <style
          // The tokens are generated text, not user input — `buildTokensCss`
          // reads only the typed constants in core and interpolates no argument
          // of any kind.
          dangerouslySetInnerHTML={{ __html: buildTokensCss() }}
        />
      </head>
      <body>
        {/* The first focusable thing in the document, and visible only when
            focused. Without it a keyboard user tabs through the whole
            navigation on every page before reaching the page itself. */}
        <a
          href="#main"
          className="sr-only rounded-control bg-primary px-three py-two text-on-primary focus:not-sr-only focus:absolute focus:top-two focus:left-two focus:z-[var(--brelly-z-overlay)]"
        >
          Skip to content
        </a>
        <Providers>
          <Bootstrap />
          <ThemeSync />
          <AppShell>{children}</AppShell>
          <DialogHost />
          <ToastHost />
        </Providers>
      </body>
    </html>
  );
}
