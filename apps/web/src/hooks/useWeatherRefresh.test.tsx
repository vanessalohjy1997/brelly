import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useToastStore } from "@brelly/core";

import { useWeatherRefresh } from "./useWeatherRefresh";

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useToastStore.setState({ toast: null, modalHosts: [] });
});

async function seed(key: unknown[], queryFn: () => Promise<unknown>) {
  await client.prefetchQuery({ queryKey: key, queryFn });
}

describe("useWeatherRefresh", () => {
  it("refetches weather queries and leaves everything else alone", async () => {
    // By prefix rather than by clearing the whole cache, so place lookups are
    // not thrown away with the forecasts.
    const weather = jest.fn().mockResolvedValue("forecast");
    const places = jest.fn().mockResolvedValue("suggestions");
    await seed(["weather", "a"], weather);
    await seed(["places", "orchard"], places);
    weather.mockClear();
    places.mockClear();

    const { result } = renderHook(() => useWeatherRefresh(), { wrapper });
    await result.current.refresh();

    expect(weather).toHaveBeenCalledTimes(1);
    expect(places).not.toHaveBeenCalled();
  });

  it("says once, for the screen, that the weather updated", async () => {
    // Staleness used to be shown per badge, so a screen of cards all still
    // saying "2h ago" — because every request failed — looked exactly like a
    // screen that had just refreshed.
    await seed(["weather", "a"], jest.fn().mockResolvedValue("forecast"));

    const { result } = renderHook(() => useWeatherRefresh(), { wrapper });
    await result.current.refresh();

    await waitFor(() =>
      expect(useToastStore.getState().toast).toMatchObject({
        message: "Weather updated",
        variant: "success",
      }),
    );
  });

  it("says so when a request failed, rather than retracting a spinner", async () => {
    await seed(["weather", "a"], jest.fn().mockRejectedValue(new Error("down")));

    const { result } = renderHook(() => useWeatherRefresh(), { wrapper });
    await result.current.refresh();

    await waitFor(() =>
      expect(useToastStore.getState().toast).toMatchObject({
        variant: "error",
      }),
    );
  });

  it("stays silent when there is nothing to refresh", async () => {
    // The empty state's button on a screen with no forecast queries mounted is
    // not a failure and is not worth a toast.
    const { result } = renderHook(() => useWeatherRefresh(), { wrapper });
    await result.current.refresh();

    expect(useToastStore.getState().toast).toBeNull();
  });

  it("reports while it is working", async () => {
    // The second call is held open deliberately: a cached query resolves
    // within the same tick, so a flag that is only true during the request is
    // otherwise unobservable.
    let release!: () => void;
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      if (calls === 1) return Promise.resolve("first");
      return new Promise<string>((resolve) => {
        release = () => resolve("second");
      });
    };
    await seed(["weather", "a"], queryFn);

    const { result } = renderHook(() => useWeatherRefresh(), { wrapper });
    expect(result.current.isRefreshing).toBe(false);

    const pending = result.current.refresh();
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));

    release();
    await pending;
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
  });
});
