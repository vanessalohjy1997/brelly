import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useWeatherRefresh } from "@/hooks/useWeatherRefresh";
import { useToastStore } from "@/store/toastStore";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
}

describe("useWeatherRefresh", () => {
  it("starts out not refreshing", async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useWeatherRefresh(), { wrapper });

    expect(result.current.isRefreshing).toBe(false);
  });

  it("refetches an on-screen weather query even though it is still fresh", async () => {
    // The forecast queries carry a 10-minute staleTime, so an `invalidate`
    // would resolve from cache and the pull gesture would do nothing visible.
    const { wrapper } = setup();
    const queryFn = jest.fn().mockResolvedValue("Cloudy");

    const { result } = await renderHook(
      () => {
        useQuery({
          queryKey: ["weather", "east", 1.3, 103.9, "t"],
          queryFn,
          staleTime: 1000 * 60 * 10,
        });
        return useWeatherRefresh();
      },
      { wrapper },
    );

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("refetches every kind of weather query", async () => {
    const { wrapper } = setup();
    const calls: string[] = [];
    const track = (key: string) => async () => {
      calls.push(key);
      return null;
    };

    const { result } = await renderHook(
      () => {
        useQuery({ queryKey: ["weather"], queryFn: track("weather") });
        useQuery({
          queryKey: ["nearbyForecast"],
          queryFn: track("nearbyForecast"),
        });
        useQuery({
          queryKey: ["liveConditions"],
          queryFn: track("liveConditions"),
        });
        useQuery({ queryKey: ["airQuality"], queryFn: track("airQuality") });
        return useWeatherRefresh();
      },
      { wrapper },
    );

    await waitFor(() => expect(calls).toHaveLength(4));
    calls.length = 0;

    await act(async () => {
      await result.current.refresh();
    });

    expect(calls.sort()).toEqual([
      "airQuality",
      "liveConditions",
      "nearbyForecast",
      "weather",
    ]);
  });

  it("leaves unrelated queries alone", async () => {
    const { wrapper } = setup();
    const placesQueryFn = jest.fn().mockResolvedValue([]);

    const { result } = await renderHook(
      () => {
        useQuery({ queryKey: ["places", "raffles"], queryFn: placesQueryFn });
        return useWeatherRefresh();
      },
      { wrapper },
    );

    await waitFor(() => expect(placesQueryFn).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(placesQueryFn).toHaveBeenCalledTimes(1);
  });

  it("clears the refreshing flag once the refetch settles", async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useWeatherRefresh(), { wrapper });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
  });

  it("clears the refreshing flag even when a refetch fails", async () => {
    const { queryClient, wrapper } = setup();
    await queryClient
      .fetchQuery({
        queryKey: ["weather", "boom"],
        queryFn: jest.fn().mockRejectedValue(new Error("offline")),
      })
      .catch(() => {});

    const { result } = await renderHook(() => useWeatherRefresh(), { wrapper });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.isRefreshing).toBe(false);
  });
});

describe("useWeatherRefresh — what the screen is told", () => {
  beforeEach(() => {
    useToastStore.setState({ toast: null, modalHosts: [] });
  });

  it("confirms the whole screen refreshed, not just each badge", async () => {
    // Staleness was shown per badge, so eight cards still saying "2h ago"
    // because every request failed looked exactly like a successful refresh.
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => {
        useQuery({
          queryKey: ["weather", "east"],
          queryFn: jest.fn().mockResolvedValue("Cloudy"),
        });
        return useWeatherRefresh();
      },
      { wrapper },
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Weather updated",
      variant: "success",
    });
  });

  it("says so when the refresh didn't reach anything", async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => {
        useQuery({
          queryKey: ["weather", "boom"],
          queryFn: jest.fn().mockRejectedValue(new Error("offline")),
        });
        return useWeatherRefresh();
      },
      { wrapper },
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(useToastStore.getState().toast).toMatchObject({
      message: "Couldn't reach the weather service",
      variant: "error",
    });
  });

  it("stays quiet when there was nothing on screen to refresh", async () => {
    // The empty state has no forecast queries mounted; "Weather updated"
    // there would be a claim about nothing.
    const { wrapper } = setup();
    const { result } = await renderHook(() => useWeatherRefresh(), { wrapper });

    await act(async () => {
      await result.current.refresh();
    });

    expect(useToastStore.getState().toast).toBeNull();
  });
});
