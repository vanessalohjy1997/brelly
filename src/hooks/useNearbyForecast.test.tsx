import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import type { ReactNode } from "react";

import { useNearbyForecast } from "@/hooks/useNearbyForecast";
import { getUpcomingForecast } from "@/services/weather";

jest.mock("@/services/weather", () => ({
  getUpcomingForecast: jest.fn().mockResolvedValue([]),
}));

const mockGetPermission = Location.getForegroundPermissionsAsync as jest.Mock;
const mockRequestPermission =
  Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPosition = Location.getCurrentPositionAsync as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPermission.mockResolvedValue({ status: "undetermined" });
  mockRequestPermission.mockResolvedValue({ status: "granted" });
  mockPosition.mockResolvedValue({
    // Marina Bay. `getRegionFromCoordinates` files this under NEA's south
    // region — the mapping itself is covered in neaRegions.test.ts.
    coords: { latitude: 1.2833, longitude: 103.8607 },
  });
});

describe("useNearbyForecast", () => {
  it("does not prompt on mount — the OS dialog needs an explanation first", async () => {
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.permission).toBe("unprompted"));
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(getUpcomingForecast).not.toHaveBeenCalled();
  });

  it("prompts only when asked, and resolves a region on grant", async () => {
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.permission).toBe("unprompted"));

    await act(async () => {
      await result.current.requestPermission();
    });

    await waitFor(() => expect(result.current.permission).toBe("granted"));
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.region).toBe("south");
    expect(result.current.isAvailable).toBe(true);
  });

  it("reports a refusal as denied so the caller can offer a way back", async () => {
    mockRequestPermission.mockResolvedValue({ status: "denied" });
    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.permission).toBe("unprompted"));

    await act(async () => {
      await result.current.requestPermission();
    });

    await waitFor(() => expect(result.current.permission).toBe("denied"));
    expect(result.current.isAvailable).toBe(false);
  });

  it("skips the prompt entirely when permission was granted on a previous run", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });

    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.permission).toBe("granted"));
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("surfaces a standing denial without re-prompting", async () => {
    mockGetPermission.mockResolvedValue({ status: "denied" });

    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.permission).toBe("denied"));
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("distinguishes a granted permission with no fix from a refusal", async () => {
    mockGetPermission.mockResolvedValue({ status: "granted" });
    mockPosition.mockRejectedValue(new Error("no fix"));

    const { result } = await renderHook(() => useNearbyForecast(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.permission).toBe("unavailable"));
  });

  it("does nothing at all when disabled — a screen with plans never prompts", async () => {
    const { result } = await renderHook(() => useNearbyForecast(false), {
      wrapper,
    });

    expect(mockGetPermission).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(result.current.forecasts).toEqual([]);
  });
});
