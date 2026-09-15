import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useLiveConditions } from "./useLiveConditions";
import { useNearbyForecast } from "./useNearbyForecast";
import { useUvIndex } from "./useUvIndex";
import { useWeatherForSlot } from "./useWeatherForSlot";

const getForecastForSlotByProvider = jest.fn();
const getLiveConditions = jest.fn();
const fetchUvIndex = jest.fn();
const getUpcomingForecast = jest.fn();

jest.mock("@brelly/core", () => ({
  ...jest.requireActual("@brelly/core"),
  getForecastForSlotByProvider: (...args: unknown[]) =>
    getForecastForSlotByProvider(...args),
  getLiveConditions: (...args: unknown[]) => getLiveConditions(...args),
  fetchUvIndex: () => fetchUvIndex(),
  getUpcomingForecast: (...args: unknown[]) => getUpcomingForecast(...args),
}));

const permission = { current: "granted" as string };
jest.mock("./useDeviceLocationPermission", () => ({
  useDeviceLocationPermission: () => ({
    permission: permission.current,
    request: jest.fn(),
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const slot = {
  provider: "nea" as const,
  region: "south" as const,
  latitude: 1.3009,
  longitude: 103.8386,
  slotStartTime: "2026-09-15T12:00:00.000Z",
};

const forecast = {
  forecast: "Light Rain",
  source: "2hr" as const,
  updatedAt: "2026-09-15T11:58:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  permission.current = "granted";
  getForecastForSlotByProvider.mockResolvedValue(forecast);
  getLiveConditions.mockResolvedValue({ stationName: "Ang Mo Kio" });
  fetchUvIndex.mockResolvedValue({ value: 7, updatedTimestamp: "t" });
  getUpcomingForecast.mockResolvedValue([]);
});

describe("useWeatherForSlot", () => {
  it("caches a good reading into browser storage", async () => {
    // The `CacheStorage` seam working rather than a coincidence: it is declared
    // structurally as `{ getItem, setItem }`, and `localStorage` satisfies it
    // verbatim — which is why this hook is the phone's with one import changed.
    const { result } = renderHook(() => useWeatherForSlot(slot), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(forecast));
    expect(window.localStorage.length).toBeGreaterThan(0);
  });

  it("answers a failed request from that cache rather than showing an error", async () => {
    // The dispatcher reports a failure as `source: "error"` rather than
    // throwing, so React Query's own retry path never sees it — the offline
    // fallback has to happen in the query function.
    const { result, unmount } = renderHook(() => useWeatherForSlot(slot), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(forecast));
    unmount();

    getForecastForSlotByProvider.mockResolvedValue({
      ...forecast,
      source: "error",
    });
    const retry = renderHook(() => useWeatherForSlot(slot), { wrapper });

    await waitFor(() =>
      expect(retry.result.current.data).toMatchObject({ source: "cached" }),
    );
  });

  it("reports the failure when there is nothing cached to fall back on", async () => {
    getForecastForSlotByProvider.mockResolvedValue({
      ...forecast,
      source: "error",
    });
    const { result } = renderHook(() => useWeatherForSlot(slot), { wrapper });

    await waitFor(() =>
      expect(result.current.data).toMatchObject({ source: "error" }),
    );
  });

  it("asks for nothing on a stop that has already finished", async () => {
    // Neither provider serves history, so an archive of a hundred past stops
    // would fire a hundred requests to render a hundred "No forecast" lines.
    renderHook(() => useWeatherForSlot({ ...slot, enabled: false }), { wrapper });

    await Promise.resolve();
    expect(getForecastForSlotByProvider).not.toHaveBeenCalled();
  });
});

describe("useLiveConditions", () => {
  it("waits for a point rather than asking about null island", async () => {
    renderHook(() => useLiveConditions(null, null), { wrapper });

    await Promise.resolve();
    expect(getLiveConditions).not.toHaveBeenCalled();
  });

  it("reads the sensors nearest a point", async () => {
    const { result } = renderHook(
      () => useLiveConditions(slot.latitude, slot.longitude),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.data).toMatchObject({ stationName: "Ang Mo Kio" }),
    );
  });
});

describe("useUvIndex", () => {
  it("needs no region and no permission", async () => {
    // NEA publishes one figure for the island, so this resolves for a user with
    // no plans and no location — which is exactly when the empty state needs
    // something to show.
    const { result } = renderHook(() => useUvIndex(), { wrapper });

    await waitFor(() =>
      expect(result.current.data).toEqual({ value: 7, updatedAt: "t" }),
    );
  });
});

describe("useNearbyForecast", () => {
  it("reports what it cannot do rather than prompting on mount", async () => {
    permission.current = "unprompted";
    const { result } = renderHook(() => useNearbyForecast(true), { wrapper });

    await waitFor(() => expect(result.current.isAvailable).toBe(false));
    expect(getUpcomingForecast).not.toHaveBeenCalled();
  });

  it("keeps the location machinery on while skipping the preview", async () => {
    // Today wants the device point for its "Right now" card even with plans,
    // and the forecast preview only in its empty state.
    renderHook(() => useNearbyForecast(true, { fetchForecast: false }), {
      wrapper,
    });

    await Promise.resolve();
    expect(getUpcomingForecast).not.toHaveBeenCalled();
  });
});
