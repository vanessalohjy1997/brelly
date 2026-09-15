import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import {
  useCloudSyncStore,
  useItineraryStore,
  useRoutineStore,
  useToastStore,
} from "@brelly/core";

import { resetDeviceLocationStore } from "@/store/deviceLocationStore";
import { useDialogStore } from "@/store/dialogStore";

/**
 * A page, rendered with the state it reads from reset to a known cold start.
 *
 * The stores are module singletons shared by every test in a file, so a page
 * that renders green in isolation and red in a suite is almost always one that
 * inherited the previous test's plans. Resetting here rather than in each
 * file's `beforeEach` is what stops that being rediscovered per page.
 */
export function resetAppState() {
  useItineraryStore.setState({ plans: [] });
  useRoutineStore.setState({ routines: [] });
  useToastStore.setState({ toast: null, modalHosts: [] });
  useDialogStore.setState({ dialog: null });
  useCloudSyncStore.setState({
    settingsReady: false,
    routinesReady: false,
    slotsReady: false,
    bootstrapError: null,
  });
  resetDeviceLocationStore();
}

/** Flips every readiness flag, which is what clears a page's skeleton. */
export function markCloudReady() {
  useCloudSyncStore.setState({
    settingsReady: true,
    routinesReady: true,
    slotsReady: true,
  });
}

export function renderRoute(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
