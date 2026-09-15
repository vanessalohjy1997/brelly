import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * Renders a component that reaches for TanStack Query.
 *
 * A fresh `QueryClient` per call, with retries off: a test exercising a failing
 * query would otherwise wait out two retries before the failure landed, and one
 * exercising a passing query would carry the previous test's cache.
 *
 * Kept out of `src/components` so it is not collected for coverage — it is a
 * harness, not a component.
 */
export function renderWithQuery(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
