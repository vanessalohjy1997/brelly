"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { configureCore } from "@brelly/core";

/**
 * Core reads no `process.env` of its own. `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*`
 * are literal text substitutions each bundler performs on its *own* files, so a
 * `process.env.X` inside core is not a variable that resolves to nothing — it
 * is a string nothing rewrites. The value is handed in from the entry point
 * that has it.
 *
 * `"proxy"` is the web arm, and it carries no key at all — by construction,
 * because `PlacesConfig` is a union rather than an optional field. This call
 * runs client-side, so any key here would be inlined into the browser bundle
 * and defeat `/api/places` in the same breath as configuring it. There is no
 * field to fill in wrongly.
 *
 * At module scope rather than in an effect: `geocoding.ts` throws rather than
 * defaulting when read unconfigured, and a place search can begin before any
 * effect has run.
 */
configureCore({
  places: {
    mode: "proxy",
    placesPath: "/api/places",
    geocodePath: "/api/places/geocode",
  },
});

/**
 * **The `QueryClient` is created per request, and that is not a style
 * preference.** The phone builds one at module scope, which is correct in a
 * single-user runtime and wrong in a shared Node process: on the server a
 * module-scope client is one cache shared by every visitor, and one user's
 * plans would be served to the next.
 *
 * `useState(() => …)` is TanStack's documented answer and does both jobs at
 * once — a fresh client per server render, and a stable one across re-renders
 * in the browser.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 10, // cache weather data for 10 minutes
            retry: 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
