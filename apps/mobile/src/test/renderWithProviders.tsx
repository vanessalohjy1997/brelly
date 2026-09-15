import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";

/**
 * Renders a component with the providers the real app wraps it in.
 *
 * Note that `render` (and `fireEvent`) are asynchronous in React Native
 * Testing Library 14 — every call has to be awaited, and the `screen` global
 * is not populated, so assertions go through the returned queries.
 *
 * Retries are switched off: a component whose query is expected to fail would
 * otherwise take three attempts to settle, and the test would either wait for
 * them or assert against a still-loading tree.
 */
export async function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = await render(ui, { wrapper });
  return { queryClient, ...view };
}
